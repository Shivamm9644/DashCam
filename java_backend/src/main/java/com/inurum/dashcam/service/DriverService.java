package com.inurum.dashcam.service;

import com.inurum.dashcam.dto.CreateDriverRequest;
import com.inurum.dashcam.dto.DriverDto;
import com.inurum.dashcam.dto.PagedResponse;
import com.inurum.dashcam.dto.UpdateDriverRequest;
import com.inurum.dashcam.entity.DriverEntity;
import com.inurum.dashcam.entity.VehicleEntity;
import com.inurum.dashcam.repository.DriverRepository;
import com.inurum.dashcam.repository.VehicleRepository;
import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.security.Roles;
import com.inurum.dashcam.web.ApiException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class DriverService {

    private final DriverRepository driverRepository;
    private final VehicleRepository vehicleRepository;
    private final AccessService accessService;
    private final AuditService auditService;

    public DriverService(DriverRepository driverRepository, VehicleRepository vehicleRepository,
                         AccessService accessService, AuditService auditService) {
        this.driverRepository = driverRepository;
        this.vehicleRepository = vehicleRepository;
        this.accessService = accessService;
        this.auditService = auditService;
    }

    public PagedResponse<DriverDto> list(CurrentUser user, Pageable pageable) {
        Page<DriverEntity> page = user.isSuperAdmin()
                ? driverRepository.findAll(pageable)
                : driverRepository.findByTenantId(user.tenantId(), pageable);

        Map<String, String> vehiclePlates = new HashMap<>();
        for (VehicleEntity v : vehicleRepository.findAll()) {
            vehiclePlates.put(v.id, v.plateNumber);
        }

        List<DriverDto> dtos = page.getContent().stream()
                .map(d -> toDto(d, vehiclePlates.get(d.assignedVehicleId)))
                .toList();

        return PagedResponse.of(dtos, pageable.getPageNumber(), pageable.getPageSize(), page.getTotalElements());
    }

    public List<DriverDto> listAll(CurrentUser user) {
        List<DriverEntity> list = user.isSuperAdmin()
                ? driverRepository.findAll()
                : driverRepository.findByTenantId(user.tenantId());

        Map<String, String> vehiclePlates = new HashMap<>();
        for (VehicleEntity v : vehicleRepository.findAll()) {
            vehiclePlates.put(v.id, v.plateNumber);
        }

        return list.stream()
                .map(d -> toDto(d, vehiclePlates.get(d.assignedVehicleId)))
                .toList();
    }

    public DriverDto get(CurrentUser user, String id) {
        DriverEntity driver = requireDriver(user, id);
        String plate = null;
        if (driver.assignedVehicleId != null) {
            plate = vehicleRepository.findById(driver.assignedVehicleId)
                    .map(v -> v.plateNumber)
                    .orElse(null);
        }
        return toDto(driver, plate);
    }

    @Transactional
    public DriverDto create(CurrentUser user, CreateDriverRequest req) {
        user.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);

        if (req.licenseNumber() != null && !req.licenseNumber().isBlank()) {
            driverRepository.findByLicenseNumber(req.licenseNumber()).ifPresent(existing -> {
                throw new ApiException(HttpStatus.CONFLICT, "LICENSE_EXISTS",
                        "A driver with license " + req.licenseNumber() + " already exists.");
            });
        }

        DriverEntity d = new DriverEntity();
        d.id = "drv-" + UUID.randomUUID().toString().substring(0, 8);
        d.tenantId = user.tenantId();
        d.name = req.name().trim();
        d.phone = req.phone();
        d.email = req.email();
        d.licenseNumber = req.licenseNumber();
        d.licenseState = req.licenseState();
        d.status = "ACTIVE";
        d.active = true;
        d.createdAt = Instant.now();

        if (req.assignedVehicleId() != null && !req.assignedVehicleId().isBlank()) {
            VehicleEntity v = accessService.requireVehicle(user, req.assignedVehicleId());
            d.assignedVehicleId = v.id;
            v.driverId = d.id;
            v.driverName = d.name;
            v.driverPhone = d.phone;
            v.driverLicense = d.licenseNumber;
            vehicleRepository.save(v);
        }

        driverRepository.save(d);
        auditService.record(user.id(), d.tenantId, "CREATE_DRIVER", d.id, Map.of("name", d.name));

        String plate = d.assignedVehicleId != null
                ? vehicleRepository.findById(d.assignedVehicleId).map(v -> v.plateNumber).orElse(null)
                : null;
        return toDto(d, plate);
    }

    @Transactional
    public DriverDto update(CurrentUser user, String id, UpdateDriverRequest req) {
        user.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        DriverEntity d = requireDriver(user, id);

        if (req.name() != null) d.name = req.name().trim();
        if (req.phone() != null) d.phone = req.phone();
        if (req.email() != null) d.email = req.email();
        if (req.licenseNumber() != null) d.licenseNumber = req.licenseNumber();
        if (req.licenseState() != null) d.licenseState = req.licenseState();
        if (req.status() != null) d.status = req.status().toUpperCase();

        if (req.assignedVehicleId() != null) {
            String newVehId = req.assignedVehicleId().trim();
            if (newVehId.isEmpty()) {
                // Unassign from old vehicle
                if (d.assignedVehicleId != null) {
                    vehicleRepository.findById(d.assignedVehicleId).ifPresent(oldV -> {
                        if (d.id.equals(oldV.driverId)) {
                            oldV.driverId = null;
                            oldV.driverName = null;
                            oldV.driverPhone = null;
                            oldV.driverLicense = null;
                            vehicleRepository.save(oldV);
                        }
                    });
                    d.assignedVehicleId = null;
                }
            } else {
                VehicleEntity v = accessService.requireVehicle(user, newVehId);
                // Unassign old vehicle if different
                if (d.assignedVehicleId != null && !d.assignedVehicleId.equals(v.id)) {
                    vehicleRepository.findById(d.assignedVehicleId).ifPresent(oldV -> {
                        if (d.id.equals(oldV.driverId)) {
                            oldV.driverId = null;
                            oldV.driverName = null;
                            oldV.driverPhone = null;
                            oldV.driverLicense = null;
                            vehicleRepository.save(oldV);
                        }
                    });
                }
                d.assignedVehicleId = v.id;
                v.driverId = d.id;
                v.driverName = d.name;
                v.driverPhone = d.phone;
                v.driverLicense = d.licenseNumber;
                vehicleRepository.save(v);
            }
        }

        d.updatedAt = Instant.now();
        driverRepository.save(d);
        auditService.record(user.id(), d.tenantId, "UPDATE_DRIVER", d.id, Map.of("name", d.name));

        String plate = d.assignedVehicleId != null
                ? vehicleRepository.findById(d.assignedVehicleId).map(v -> v.plateNumber).orElse(null)
                : null;
        return toDto(d, plate);
    }

    @Transactional
    public void delete(CurrentUser user, String id) {
        user.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        DriverEntity d = requireDriver(user, id);

        if (d.assignedVehicleId != null) {
            vehicleRepository.findById(d.assignedVehicleId).ifPresent(v -> {
                if (d.id.equals(v.driverId)) {
                    v.driverId = null;
                    v.driverName = null;
                    v.driverPhone = null;
                    v.driverLicense = null;
                    vehicleRepository.save(v);
                }
            });
        }

        d.active = false;
        d.status = "INACTIVE";
        d.updatedAt = Instant.now();
        driverRepository.save(d);
        auditService.record(user.id(), d.tenantId, "DEACTIVATE_DRIVER", d.id, Map.of("name", d.name));
    }

    public DriverEntity requireDriver(CurrentUser user, String id) {
        DriverEntity d = driverRepository.findById(id).orElse(null);
        if (d == null || (!user.isSuperAdmin() && !d.tenantId.equals(user.tenantId()))) {
            throw ApiException.notFound("DRIVER_NOT_FOUND", "Driver not found.");
        }
        return d;
    }

    public static DriverDto toDto(DriverEntity d, String assignedVehiclePlate) {
        return new DriverDto(
                d.id,
                d.tenantId,
                d.name,
                d.phone,
                d.email,
                d.licenseNumber,
                d.licenseState,
                d.status,
                d.assignedVehicleId,
                assignedVehiclePlate,
                d.active,
                d.createdAt,
                d.updatedAt
        );
    }
}

