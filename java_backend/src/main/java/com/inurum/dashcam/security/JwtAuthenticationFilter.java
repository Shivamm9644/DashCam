package com.inurum.dashcam.security;

import com.inurum.dashcam.config.BootstrapInitializer;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;

/**
 * Validates authentication on all /api/v1 routes:
 * 1. Bearer JWT token in Authorization header.
 * 2. Server-to-server X-API-KEY header for enterprise integrations (TruckerCloud).
 * Login and non-API paths are exempted.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final String integrationApiKey;

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider,
                                   @Value("${security.integration.api-key:inurum-tc-prod-key-2026}") String integrationApiKey) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.integrationApiKey = integrationApiKey;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.startsWith("/api/v1/")
                || path.equals("/api/v1/auth/login")
                || "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // Check for server-to-server API Key (e.g. TruckerCloud aggregator)
        String apiKey = request.getHeader("X-API-KEY");
        if (apiKey == null) apiKey = request.getHeader("X-Integration-Key");

        if (apiKey != null && !apiKey.isBlank() && apiKey.equals(integrationApiKey)) {
            // Authenticate as system integration service account with SUPER_ADMIN privileges
            request.setAttribute(CurrentUser.REQUEST_ATTRIBUTE, new CurrentUser(
                    "srv-truckercloud",
                    "integration@truckercloud.com",
                    Roles.SUPER_ADMIN,
                    BootstrapInitializer.PLATFORM_TENANT_ID));
            filterChain.doFilter(request, response);
            return;
        }

        // Standard Bearer JWT Token
        String authHeader = request.getHeader("Authorization");
        Map<String, Object> claims = authHeader != null && authHeader.startsWith("Bearer ")
                ? jwtTokenProvider.verify(authHeader.substring(7).trim())
                : null;

        if (claims == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"UNAUTHORIZED\",\"message\":\"Authentication required. Provide a valid Bearer JWT token or X-API-KEY header.\"}");
            return;
        }

        request.setAttribute(CurrentUser.REQUEST_ATTRIBUTE, new CurrentUser(
                (String) claims.get("sub"),
                (String) claims.get("email"),
                (String) claims.get("role"),
                (String) claims.get("tenantId")));
        filterChain.doFilter(request, response);
    }
}
