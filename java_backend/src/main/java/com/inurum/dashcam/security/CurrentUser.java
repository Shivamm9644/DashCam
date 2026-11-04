package com.inurum.dashcam.security;

import com.inurum.dashcam.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;

import java.util.Arrays;

/**
 * The authenticated caller, taken from the verified JWT by {@link JwtAuthenticationFilter}.
 */
public record CurrentUser(String id, String email, String role, String tenantId) {

    static final String REQUEST_ATTRIBUTE = "inurum.currentUser";

    public static CurrentUser from(HttpServletRequest request) {
        CurrentUser user = (CurrentUser) request.getAttribute(REQUEST_ATTRIBUTE);
        if (user == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Login required.");
        return user;
    }

    public boolean isSuperAdmin() {
        return Roles.SUPER_ADMIN.equals(role);
    }

    public void requireRole(String... roles) {
        if (Arrays.asList(roles).contains(role)) return;
        throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Your role (" + role + ") cannot do this.");
    }
}
