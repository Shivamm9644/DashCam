package com.inurum.dashcam.service;

import com.inurum.dashcam.entity.TenantEntity;
import com.inurum.dashcam.entity.UserVehicleAccessEntity;
import com.inurum.dashcam.entity.VehicleEntity;
import com.inurum.dashcam.repository.TenantRepository;
import com.inurum.dashcam.repository.UserVehicleAccessRepository;
import com.inurum.dashcam.repository.VehicleRepository;
import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.web.ApiException;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * What each caller may see. SUPER_ADMIN: everything. Everyone else: their tenant, narrowed to the
 * cameras assigned to them when they have an assignment.
 */
@Service
public class AccessService {

    private final VehicleRepository vehicleRepository;
    private final UserVehicleAccessRepository accessRepository;
    private final TenantRepository tenantRepository;

    public AccessService(VehicleRepository vehicleRepository, UserVehicleAccessRepository accessRepository,
                         TenantRepository tenantRepository) {
        this.vehicleRepository = vehicleRepository;
        this.accessRepository = accessRepository;
        this.tenantRepository = tenantRepository;
    }

    public List<VehicleEntity> visibleVehicles(CurrentUser user) {
        if (user.isSuperAdmin()) return vehicleRepository.findAll();
        List<VehicleEntity> tenantVehicles = vehicleRepository.findByTenantId(user.tenantId());
        Set<String> allowed = allowedTerminals(user.id());
        if (allowed.isEmpty()) return tenantVehicles;
        return tenantVehicles.stream().filter(v -> allowed.contains(v.assignedDeviceId)).collect(Collectors.toList());
    }

    public Set<String> visibleTerminals(CurrentUser user) {
        return visibleVehicles(user).stream()
                .map(v -> v.assignedDeviceId).filter(Objects::nonNull).collect(Collectors.toSet());
    }

    /** The vehicle a camera belongs to, if the caller may see it; SUPER_ADMIN may also reach unpaired cameras */
    public Optional<VehicleEntity> requireTerminal(CurrentUser user, String terminalId) {
        if (terminalId == null || terminalId.isBlank()) throw ApiException.badRequest("MISSING_TERMINAL_ID", "terminalId is required.");
        Optional<VehicleEntity> vehicle = vehicleRepository.findByAssignedDeviceId(terminalId);
        if (user.isSuperAdmin()) return vehicle;
        if (vehicle.isPresent() && visibleTerminals(user).contains(terminalId)) return vehicle;
        throw ApiException.notFound("DEVICE_NOT_FOUND", "Dashcam " + terminalId + " is not in your fleet.");
    }

    public VehicleEntity requireVehicle(CurrentUser user, String vehicleId) {
        VehicleEntity v = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> ApiException.notFound("VEHICLE_NOT_FOUND", "Vehicle not found."));
        if (!user.isSuperAdmin() && !v.tenantId.equals(user.tenantId())) {
            throw ApiException.notFound("VEHICLE_NOT_FOUND", "Vehicle not found.");
        }
        return v;
    }

    public long camerasOfTenant(String tenantId) {
        return vehicleRepository.findByTenantId(tenantId).stream().filter(v -> v.assignedDeviceId != null).count();
    }

    public Set<String> allowedTerminals(String userId) {
        return accessRepository.findByUserId(userId).stream()
                .map(a -> a.terminalId).collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public List<String> allowedTerminalList(String userId) {
        return accessRepository.findByUserId(userId).stream().map((UserVehicleAccessEntity a) -> a.terminalId).toList();
    }

    public Map<String, String> tenantNames() {
        Map<String, String> names = new HashMap<>();
        for (TenantEntity t : tenantRepository.findAll()) names.put(t.id, t.name);
        return names;
    }

    /** SUPER_ADMIN may act on any tenant; others only on their own */
    public void requireSameTenant(CurrentUser user, String tenantId) {
        if (!user.isSuperAdmin() && !Objects.equals(user.tenantId(), tenantId)) {
            throw new ApiException(org.springframework.http.HttpStatus.FORBIDDEN, "FORBIDDEN", "Not allowed outside your organization.");
        }
    }
}
