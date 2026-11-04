package com.inurum.dashcam.controller;

import com.inurum.dashcam.entity.TenantEntity;
import com.inurum.dashcam.entity.UserEntity;
import com.inurum.dashcam.repository.TenantRepository;
import com.inurum.dashcam.repository.UserRepository;
import com.inurum.dashcam.security.JwtTokenProvider;
import com.inurum.dashcam.service.AccessService;
import com.inurum.dashcam.service.AuditService;
import com.inurum.dashcam.web.ApiException;
import com.inurum.dashcam.web.Body;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

import static com.inurum.dashcam.web.Json.obj;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication", description = "User authentication, JWT token generation, and role identification")
public class AuthController {

    private final UserRepository users;
    private final TenantRepository tenants;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwt;
    private final AccessService access;
    private final AuditService audit;

    public AuthController(UserRepository users, TenantRepository tenants, PasswordEncoder passwordEncoder,
                          JwtTokenProvider jwt, AccessService access, AuditService audit) {
        this.users = users;
        this.tenants = tenants;
        this.passwordEncoder = passwordEncoder;
        this.jwt = jwt;
        this.access = access;
        this.audit = audit;
    }

    @PostMapping("/login")
    @SecurityRequirements() // Exempt login from global JWT requirement in Swagger UI
    @Operation(summary = "Log in with email + password; returns a 12-hour JWT Bearer token")
    public Map<String, Object> login(@RequestBody(required = false) Map<String, Object> body) {
        String email = Body.str(body, "email");
        if (email == null) email = Body.str(body, "username");
        String password = Body.str(body, "password");
        if (email == null || password == null) {
            throw ApiException.badRequest("MISSING_CREDENTIALS", "Email and password are required.");
        }

        UserEntity user = users.findByEmail(email.toLowerCase()).orElse(null);
        if (user == null || !passwordEncoder.matches(password, user.passwordHash)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid email address or password.");
        }
        TenantEntity tenant = tenants.findById(user.tenantId).orElse(null);
        if (!"ACTIVE".equals(user.status) || (tenant != null && !"ACTIVE".equals(tenant.status))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_DISABLED", "This account or its organization is deactivated.");
        }

        user.lastLoginAt = Instant.now();
        users.save(user);
        audit.record(user.id, user.tenantId, "AUTH_LOGIN", user.email, Map.of("role", user.role));

        String token = jwt.createToken(user.id, user.email, user.role, user.tenantId);
        return obj(
                "token", token,
                "accessToken", token,
                "tokenType", "Bearer",
                "user", obj(
                        "id", user.id,
                        "name", user.name,
                        "email", user.email,
                        "role", user.role,
                        "tenantId", user.tenantId,
                        "tenantName", tenant != null ? tenant.name : user.tenantId,
                        "allowedVehicles", access.allowedTerminalList(user.id)));
    }
}
