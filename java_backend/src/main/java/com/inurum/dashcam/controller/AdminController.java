package com.inurum.dashcam.controller;

import com.inurum.dashcam.entity.*;
import com.inurum.dashcam.gateway.GatewayClient;
import com.inurum.dashcam.repository.*;
import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.security.Roles;
import com.inurum.dashcam.service.AccessService;
import com.inurum.dashcam.service.AuditService;
import com.inurum.dashcam.service.CostControlService;
import com.inurum.dashcam.service.LiveService;
import com.inurum.dashcam.web.ApiException;
import com.inurum.dashcam.web.Body;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static com.inurum.dashcam.web.Json.obj;

@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "Administration")
public class AdminController {

    private static final Set<String> PLANS = Set.of("INR_500_ANNUAL", "ENTERPRISE");

    private final TenantRepository tenants;
    private final UserRepository users;
    private final UserVehicleAccessRepository vehicleAccess;
    private final VehicleRepository vehicles;
    private final AuditLogRepository auditLogs;
    private final AccessService access;
    private final CostControlService costControls;
    private final LiveService live;
    private final GatewayClient gateway;
    private final AuditService audit;
    private final PasswordEncoder passwordEncoder;

    public AdminController(TenantRepository tenants, UserRepository users, UserVehicleAccessRepository vehicleAccess,
                           VehicleRepository vehicles, AuditLogRepository auditLogs, AccessService access,
                           CostControlService costControls, LiveService live, GatewayClient gateway,
                           AuditService audit, PasswordEncoder passwordEncoder) {
        this.tenants = tenants;
        this.users = users;
        this.vehicleAccess = vehicleAccess;
        this.vehicles = vehicles;
        this.auditLogs = auditLogs;
        this.access = access;
        this.costControls = costControls;
        this.live = live;
        this.gateway = gateway;
        this.audit = audit;
        this.passwordEncoder = passwordEncoder;
    }

    // ── Platform metrics & organizations ─────────────────────────────────

    @GetMapping("/saas-metrics")
    @Operation(summary = "Platform totals (SUPER_ADMIN)")
    public Map<String, Object> metrics(HttpServletRequest req) {
        CurrentUser.from(req).requireRole(Roles.SUPER_ADMIN);
        List<TenantEntity> all = tenants.findAll();
        long cameras = vehicles.findAll().stream().filter(v -> v.assignedDeviceId != null).count();
        long online = gateway.devices().values().stream().filter(d -> d.online()).count();
        return obj("metrics", obj(
                "totalOrganizations", all.size(),
                "activeOrganizations", all.stream().filter(t -> "ACTIVE".equals(t.status)).count(),
                "totalVehicles", vehicles.count(),
                "totalDevices", cameras,
                "onlineDevices", online,
                // Footage stays on the cameras' SD cards; the server keeps only short-lived live segments
                "totalStorageUsedMb", 0,
                "liveMinutesThisMonth", live.minutesUsedThisMonth(null)));
    }

    @GetMapping("/organizations")
    public Map<String, Object> organizations(HttpServletRequest req) {
        CurrentUser user = CurrentUser.from(req);
        user.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        List<Map<String, Object>> list = new ArrayList<>();
        for (TenantEntity t : tenants.findAll()) {
            if (!user.isSuperAdmin() && !t.id.equals(user.tenantId())) continue;
            list.add(orgView(t));
        }
        return obj("organizations", list, "total", list.size());
    }

    @PostMapping("/organizations")
    @Operation(summary = "Create an organization (SUPER_ADMIN): name, code, contactEmail, plan")
    public ResponseEntity<Map<String, Object>> createOrganization(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        CurrentUser user = CurrentUser.from(req);
        user.requireRole(Roles.SUPER_ADMIN);
        String code = Body.required(body, "code").toUpperCase();
        if (!code.matches("[A-Z0-9_-]{2,32}")) throw ApiException.badRequest("BAD_CODE", "code: 2-32 letters, digits, - or _.");
        if (tenants.existsByCode(code)) throw ApiException.badRequest("DUPLICATE_CODE", "Organization code already exists.");
        String plan = Optional.ofNullable(Body.str(body, "plan")).orElse("INR_500_ANNUAL");
        if (!PLANS.contains(plan)) throw ApiException.badRequest("BAD_PLAN", "plan must be one of " + PLANS);

        TenantEntity t = new TenantEntity();
        t.id = "tenant-" + code.toLowerCase();
        t.name = Body.required(body, "name");
        t.code = code;
        t.contactEmail = Body.required(body, "contactEmail").toLowerCase();
        t.plan = plan;
        t.status = "ACTIVE";
        t.createdAt = Instant.now();
        t.subscriptionEnd = t.createdAt.plus(365, ChronoUnit.DAYS);
        tenants.save(t);
        audit.record(user.id(), t.id, "CREATE_ORG", t.id, Map.of("name", t.name, "code", t.code));
        return ResponseEntity.status(HttpStatus.CREATED).body(obj("organization", orgView(t), "message", "Organization created."));
    }

    @PostMapping("/organizations/{id}/toggle-status")
    public Map<String, Object> toggleOrganization(HttpServletRequest req, @PathVariable String id) {
        CurrentUser user = CurrentUser.from(req);
        user.requireRole(Roles.SUPER_ADMIN);
        TenantEntity t = tenants.findById(id).orElseThrow(() -> ApiException.notFound("ORG_NOT_FOUND", "Organization not found."));
        if (t.id.equals(user.tenantId())) throw ApiException.badRequest("OWN_ORG", "You cannot suspend your own organization.");
        t.status = "ACTIVE".equals(t.status) ? "SUSPENDED" : "ACTIVE";
        tenants.save(t);
        audit.record(user.id(), t.id, "TOGGLE_ORG_STATUS", t.id, Map.of("status", t.status));
        return obj("organization", orgView(t), "message", "Organization is now " + t.status + ".");
    }

    private Map<String, Object> orgView(TenantEntity t) {
        List<VehicleEntity> vs = vehicles.findByTenantId(t.id);
        return obj(
                "id", t.id,
                "name", t.name,
                "code", t.code,
                "contactEmail", t.contactEmail,
                "plan", t.plan,
                "status", t.status,
                "subscriptionEnd", t.subscriptionEnd,
                "vehiclesCount", vs.size(),
                "camerasCount", vs.stream().filter(v -> v.assignedDeviceId != null).count(),
                "storageUsedBytes", 0,
                "storageQuotaBytes", null,
                "streamingMinutesUsed", live.minutesUsedThisMonth(t.id),
                "createdAt", t.createdAt);
    }

    // ── Users ───────────────────────────────────────────────────────────

    @GetMapping("/users")
    public Map<String, Object> listUsers(HttpServletRequest req) {
        CurrentUser user = CurrentUser.from(req);
        user.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        List<UserEntity> list = user.isSuperAdmin() ? users.findAll() : users.findByTenantId(user.tenantId());
        Map<String, String> names = access.tenantNames();
        return obj("users", list.stream().map(u -> userView(u, names)).toList(), "total", list.size());
    }

    @PostMapping("/users")
    @Operation(summary = "Create a user: name, email, role, password (6+ chars), tenantId (SUPER_ADMIN only)")
    public ResponseEntity<Map<String, Object>> createUser(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        CurrentUser op = CurrentUser.from(req);
        op.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        String email = Body.required(body, "email").toLowerCase();
        if (!email.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) throw ApiException.badRequest("BAD_EMAIL", "Enter a valid email address.");
        if (users.findByEmail(email).isPresent()) throw ApiException.badRequest("DUPLICATE_EMAIL", "A user with this email already exists.");
        String role = Optional.ofNullable(Body.str(body, "role")).orElse(Roles.CUSTOMER).toUpperCase();
        if (!Roles.ALL.contains(role)) throw ApiException.badRequest("BAD_ROLE", "role must be one of " + Roles.ALL);
        if (Roles.SUPER_ADMIN.equals(role) && !op.isSuperAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only a SUPER_ADMIN can create another SUPER_ADMIN.");
        }
        String tenantId = op.isSuperAdmin() ? Optional.ofNullable(Body.str(body, "tenantId")).orElse(op.tenantId()) : op.tenantId();
        if (!tenants.existsById(tenantId)) throw ApiException.badRequest("ORG_NOT_FOUND", "Organization not found.");

        UserEntity u = new UserEntity();
        u.id = "usr-" + UUID.randomUUID().toString().substring(0, 8);
        u.tenantId = tenantId;
        u.name = Body.required(body, "name");
        u.email = email;
        u.passwordHash = passwordEncoder.encode(password(Body.str(body, "password")));
        u.role = role;
        u.status = "ACTIVE";
        u.createdAt = Instant.now();
        users.save(u);
        audit.record(op.id(), tenantId, "INVITE_USER", u.id, Map.of("email", u.email, "role", u.role));
        return ResponseEntity.status(HttpStatus.CREATED).body(obj("user", userView(u, access.tenantNames()), "message", "User created."));
    }

    @PostMapping("/users/{id}/toggle-status")
    public Map<String, Object> toggleUser(HttpServletRequest req, @PathVariable String id) {
        CurrentUser op = CurrentUser.from(req);
        op.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        UserEntity u = requireUser(op, id);
        if (u.id.equals(op.id())) throw ApiException.badRequest("SELF", "You cannot deactivate yourself.");
        u.status = "ACTIVE".equals(u.status) ? "INACTIVE" : "ACTIVE";
        users.save(u);
        audit.record(op.id(), u.tenantId, "TOGGLE_USER_STATUS", u.id, Map.of("status", u.status));
        return obj("user", userView(u, access.tenantNames()), "message", "User is now " + u.status + ".");
    }

    @PostMapping("/users/{id}/vehicle-access")
    @Operation(summary = "Restrict a user to these cameras (terminalIds); an empty list = all vehicles of their organization")
    public Map<String, Object> setVehicleAccess(HttpServletRequest req, @PathVariable String id, @RequestBody Map<String, Object> body) {
        CurrentUser op = CurrentUser.from(req);
        op.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        UserEntity u = requireUser(op, id);
        Object raw = body.get("terminalIds");
        if (!(raw instanceof List<?> ids)) throw ApiException.badRequest("MISSING_FIELD", "terminalIds (array) is required.");

        Set<String> tenantCameras = new HashSet<>();
        for (VehicleEntity v : vehicles.findByTenantId(u.tenantId)) if (v.assignedDeviceId != null) tenantCameras.add(v.assignedDeviceId);
        List<String> clean = new ArrayList<>();
        for (Object o : ids) {
            String t = String.valueOf(o);
            if (!tenantCameras.contains(t)) throw ApiException.badRequest("NOT_IN_ORG", "Camera " + t + " is not in this user's organization.");
            if (!clean.contains(t)) clean.add(t);
        }
        vehicleAccess.deleteByUserId(u.id);
        for (String t : clean) vehicleAccess.save(new UserVehicleAccessEntity(u.id, t));
        audit.record(op.id(), u.tenantId, "SET_VEHICLE_SCOPE", u.id, Map.of("terminalIds", clean));
        return obj("user", userView(u, access.tenantNames()), "message", "Vehicle access updated.");
    }

    @PostMapping("/users/{id}/reset-password")
    @Operation(summary = "Set a new password (6+ chars) for a user")
    public Map<String, Object> resetPassword(HttpServletRequest req, @PathVariable String id, @RequestBody Map<String, Object> body) {
        CurrentUser op = CurrentUser.from(req);
        op.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        UserEntity u = requireUser(op, id);
        u.passwordHash = passwordEncoder.encode(password(Body.str(body, "newPassword")));
        users.save(u);
        audit.record(op.id(), u.tenantId, "RESET_PASSWORD", u.id, Map.of());
        return obj("message", "Password changed.");
    }

    private UserEntity requireUser(CurrentUser op, String id) {
        UserEntity u = users.findById(id).orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "User not found."));
        access.requireSameTenant(op, u.tenantId);
        if (Roles.SUPER_ADMIN.equals(u.role) && !op.isSuperAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only a SUPER_ADMIN can change a SUPER_ADMIN.");
        }
        return u;
    }

    private static String password(String p) {
        if (p == null || p.length() < 6) throw ApiException.badRequest("WEAK_PASSWORD", "Password must be at least 6 characters.");
        return p;
    }

    private Map<String, Object> userView(UserEntity u, Map<String, String> tenantNames) {
        return obj(
                "id", u.id,
                "tenantId", u.tenantId,
                "tenantName", tenantNames.getOrDefault(u.tenantId, u.tenantId),
                "name", u.name,
                "email", u.email,
                "role", u.role,
                "status", u.status,
                "allowedVehicles", access.allowedTerminalList(u.id),
                "createdAt", u.createdAt,
                "lastLoginAt", u.lastLoginAt);
    }

    // ── Cost controls & media ───────────────────────────────────────────

    @GetMapping("/cost-controls")
    public Map<String, Object> getCostControls(HttpServletRequest req) {
        CurrentUser user = CurrentUser.from(req);
        user.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        return obj("costControls", CostControlService.view(costControls.forTenant(user.tenantId())));
    }

    @PutMapping("/cost-controls")
    @Operation(summary = "Update the caller's organization limits")
    public Map<String, Object> updateCostControls(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        CurrentUser user = CurrentUser.from(req);
        user.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        CostControlEntity c = costControls.forTenant(user.tenantId());
        c.maxStreamDurationSeconds = range(body, "maxStreamDurationSeconds", c.maxStreamDurationSeconds, 30, 600);
        c.monthlyStreamingQuotaMinutes = range(body, "monthlyStreamingQuotaMinutes", c.monthlyStreamingQuotaMinutes, 0, 6000);
        c.maxConcurrentStreams = range(body, "maxConcurrentStreams", c.maxConcurrentStreams, 1, 50);
        c.routineVideoRetentionDays = range(body, "routineVideoRetentionDays", c.routineVideoRetentionDays, 1, 365);
        c.incidentVideoRetentionDays = range(body, "incidentVideoRetentionDays", c.incidentVideoRetentionDays, 1, 3650);
        costControls.save(c);
        audit.record(user.id(), user.tenantId(), "UPDATE_COST_CONTROLS", user.tenantId(), body);
        return obj("costControls", CostControlService.view(c), "message", "Cost controls saved.");
    }

    @PostMapping("/cleanup-media")
    @Operation(summary = "Media purge. The server stores no footage (it stays on the SD cards), so there is never anything to delete")
    public Map<String, Object> cleanupMedia(HttpServletRequest req) {
        CurrentUser user = CurrentUser.from(req);
        user.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        CostControlEntity c = costControls.forTenant(user.tenantId());
        c.lastPurgeBytesCleaned = 0;
        costControls.save(c);
        return obj("message", "No footage is stored on the server; nothing to clean.",
                "result", obj("cleanedBytes", 0, "cleanedFilesCount", 0));
    }

    private static int range(Map<String, Object> body, String key, int current, int min, int max) {
        Integer v = Body.integer(body, key);
        if (v == null) return current;
        if (v < min || v > max) throw ApiException.badRequest("OUT_OF_RANGE", key + " must be between " + min + " and " + max + ".");
        return v;
    }

    // ── Audit log ───────────────────────────────────────────────────────

    @GetMapping("/audit-logs")
    public Map<String, Object> auditLogs(HttpServletRequest req, @RequestParam(defaultValue = "50") int limit) {
        CurrentUser user = CurrentUser.from(req);
        user.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        PageRequest page = PageRequest.of(0, Math.max(1, Math.min(limit, 500)));
        List<AuditLogEntity> logs = user.isSuperAdmin()
                ? auditLogs.findAllByOrderByTimestampDesc(page)
                : auditLogs.findByTenantIdOrderByTimestampDesc(user.tenantId(), page);
        List<Map<String, Object>> list = logs.stream().map(l -> obj(
                "id", l.id,
                "timestamp", l.timestamp,
                "actorId", l.actorId,
                "tenantId", l.tenantId,
                "action", l.action,
                "resource", l.resource,
                "details", l.details)).toList();
        return obj("auditLogs", list, "total", list.size());
    }
}
