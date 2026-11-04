package com.inurum.dashcam.controller;

import com.inurum.dashcam.dto.CreateVehicleRequest;
import com.inurum.dashcam.dto.UpdateVehicleRequest;
import com.inurum.dashcam.dto.VehicleDto;
import com.inurum.dashcam.entity.DriverEntity;
import com.inurum.dashcam.entity.VehicleEntity;
import com.inurum.dashcam.gateway.GatewayClient;
import com.inurum.dashcam.repository.DriverRepository;
import com.inurum.dashcam.repository.VehicleRepository;
import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.security.Roles;
import com.inurum.dashcam.service.AccessService;
import com.inurum.dashcam.service.AuditService;
import com.inurum.dashcam.service.FleetService;
import com.inurum.dashcam.web.ApiException;
import com.inurum.dashcam.web.Body;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import static com.inurum.dashcam.web.Json.obj;

@RestController
@RequestMapping("/api/v1/vehicles")
@Tag(name = "Vehicles", description = "Vehicle inventory, VIN mapping, DashCam pairing and driver assignment")
public class VehicleController {

    private static final Pattern VIN_PATTERN = Pattern.compile("^[A-HJ-NPR-Z0-9]{17}$");

    private final VehicleRepository vehicles;
    private final AccessService access;
    private final FleetService fleet;
    private final GatewayClient gateway;
    private final AuditService audit;
    private final DriverRepository driverRepository;

    public VehicleController(VehicleRepository vehicles, AccessService access, FleetService fleet,
                             GatewayClient gateway, AuditService audit, DriverRepository driverRepository) {
        this.vehicles = vehicles;
        this.access = access;
        this.fleet = fleet;
        this.gateway = gateway;
        this.audit = audit;
        this.driverRepository = driverRepository;
    }

    @GetMapping
    @Operation(summary = "Vehicles list with live camera status, VIN, odometer and GPS")
    public Map<String, Object> list(HttpServletRequest req) {
        List<Map<String, Object>> list = fleet.views(access.visibleVehicles(CurrentUser.from(req)));
        return obj("vehicles", list, "total", list.size(), "gatewayReachable", gateway.isReachable());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get single vehicle details by ID with VIN, paired DashCam, and telematics")
    public VehicleDto get(HttpServletRequest req, @PathVariable String id) {
        CurrentUser user = CurrentUser.from(req);
        VehicleEntity v = access.requireVehicle(user, id);
        return fleet.getDto(v);
    }

    @PostMapping
    @Operation(summary = "Add a vehicle (plateNumber required, optional 17-char VIN, IMEI, and driver assignment)")
    public ResponseEntity<Map<String, Object>> create(HttpServletRequest req, @Valid @RequestBody Map<String, Object> body) {
        CurrentUser user = CurrentUser.from(req);
        user.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);

        VehicleEntity v = new VehicleEntity();
        v.id = "veh-" + UUID.randomUUID().toString().substring(0, 8);
        v.tenantId = user.tenantId();
        v.createdAt = Instant.now();

        applyFields(v, body, user);

        if (v.plateNumber == null || v.plateNumber.isBlank()) {
            throw ApiException.badRequest("MISSING_FIELD", "plateNumber is required.");
        }

        vehicles.save(v);
        audit.record(user.id(), v.tenantId, "CREATE_VEHICLE", v.id, Map.of("plate", v.plateNumber, "vin", v.vin != null ? v.vin : ""));
        return ResponseEntity.status(HttpStatus.CREATED).body(obj("vehicle", fleet.viewOne(v)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Edit a vehicle's plate, VIN, label, model, odometer and driver details")
    public Map<String, Object> update(HttpServletRequest req, @PathVariable String id, @RequestBody Map<String, Object> body) {
        CurrentUser user = CurrentUser.from(req);
        user.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        VehicleEntity v = access.requireVehicle(user, id);

        applyFields(v, body, user);
        v.updatedAt = Instant.now();
        vehicles.save(v);
        audit.record(user.id(), v.tenantId, "UPDATE_VEHICLE", v.id, Map.of("plate", v.plateNumber));
        return obj("vehicle", fleet.viewOne(v));
    }

    @PostMapping("/{id}/toggle-status")
    @Operation(summary = "Deactivate / reactivate a vehicle")
    public Map<String, Object> toggle(HttpServletRequest req, @PathVariable String id) {
        CurrentUser user = CurrentUser.from(req);
        user.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        VehicleEntity v = access.requireVehicle(user, id);
        v.active = !v.active;
        v.updatedAt = Instant.now();
        vehicles.save(v);
        audit.record(user.id(), v.tenantId, "TOGGLE_VEHICLE_STATUS", v.id, Map.of("active", v.active));
        return obj("vehicle", fleet.viewOne(v), "message", v.active ? "Vehicle reactivated." : "Vehicle deactivated.");
    }

    @PostMapping("/{id}/pair-device")
    @Operation(summary = "Pair a dashcam (terminalId) with this vehicle; one camera per vehicle")
    public Map<String, Object> pair(HttpServletRequest req, @PathVariable String id, @RequestBody Map<String, Object> body) {
        CurrentUser user = CurrentUser.from(req);
        user.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        VehicleEntity v = access.requireVehicle(user, id);
        String terminalId = Body.required(body, "terminalId");
        if (!terminalId.matches("\\d{6,20}")) {
            throw ApiException.badRequest("BAD_TERMINAL_ID", "terminalId must be the camera's numeric JT808 id.");
        }
        vehicles.findByAssignedDeviceId(terminalId).filter(other -> !other.id.equals(v.id)).ifPresent(other -> {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_PAIRED",
                    "Dashcam " + terminalId + " is already paired to " + other.plateNumber + ". Unpair it first.");
        });
        v.assignedDeviceId = terminalId;
        v.updatedAt = Instant.now();
        vehicles.save(v);
        audit.record(user.id(), v.tenantId, "PAIR_DEVICE", v.id, Map.of("terminalId", terminalId));
        return obj("vehicle", fleet.viewOne(v), "message", "Dashcam " + terminalId + " paired.");
    }

    @PostMapping("/{id}/unpair-device")
    @Operation(summary = "Remove the dashcam from this vehicle")
    public Map<String, Object> unpair(HttpServletRequest req, @PathVariable String id) {
        CurrentUser user = CurrentUser.from(req);
        user.requireRole(Roles.SUPER_ADMIN, Roles.ADMIN);
        VehicleEntity v = access.requireVehicle(user, id);
        String old = v.assignedDeviceId;
        v.assignedDeviceId = null;
        v.updatedAt = Instant.now();
        vehicles.save(v);
        audit.record(user.id(), v.tenantId, "UNPAIR_DEVICE", v.id, obj("previousTerminalId", old));
        return obj("vehicle", fleet.viewOne(v), "message", "Dashcam unpaired.");
    }

    private void applyFields(VehicleEntity v, Map<String, Object> body, CurrentUser user) {
        String plate = Body.str(body, "plateNumber");
        if (plate != null) v.plateNumber = plate.toUpperCase().trim();

        // 17-character VIN validation
        if (body.containsKey("vin")) {
            String vinStr = Body.str(body, "vin");
            if (vinStr != null && !vinStr.isBlank()) {
                String normalizedVin = vinStr.toUpperCase().trim();
                if (!VIN_PATTERN.matcher(normalizedVin).matches()) {
                    throw ApiException.badRequest("INVALID_VIN",
                            "VIN must be exactly 17 alphanumeric characters (excluding letters I, O, Q).");
                }
                vehicles.findByVin(normalizedVin).filter(other -> !other.id.equals(v.id)).ifPresent(other -> {
                    throw new ApiException(HttpStatus.CONFLICT, "VIN_EXISTS",
                            "Vehicle with VIN " + normalizedVin + " already exists (" + other.plateNumber + ").");
                });
                v.vin = normalizedVin;
            } else {
                v.vin = null;
            }
        }

        if (body.containsKey("imei")) {
            v.imei = Body.str(body, "imei");
        }

        String label = Body.str(body, "label");
        if (label != null) v.label = label;
        if (body.containsKey("model")) v.model = Body.str(body, "model");
        if (body.containsKey("year")) v.year = Body.integer(body, "year");

        // Odometer support with clearly identified source
        if (body.containsKey("odometerKm")) {
            Object odoObj = body.get("odometerKm");
            if (odoObj instanceof Number n) {
                v.odometerKm = n.doubleValue();
            }
        }
        if (body.containsKey("odometerSource")) {
            String src = Body.str(body, "odometerSource");
            if (src != null) {
                String upper = src.toUpperCase();
                if (!"ECU".equals(upper) && !"GPS_ESTIMATED".equals(upper)) {
                    throw ApiException.badRequest("BAD_ODOMETER_SOURCE", "odometerSource must be 'ECU' or 'GPS_ESTIMATED'.");
                }
                v.odometerSource = upper;
            }
        }

        // Driver assignment
        if (body.containsKey("driverId")) {
            String drvId = Body.str(body, "driverId");
            if (drvId != null && !drvId.isBlank()) {
                DriverEntity d = driverRepository.findById(drvId).orElse(null);
                if (d != null && (user.isSuperAdmin() || d.tenantId.equals(user.tenantId()))) {
                    v.driverId = d.id;
                    v.driverName = d.name;
                    v.driverPhone = d.phone;
                    v.driverLicense = d.licenseNumber;
                }
            } else {
                v.driverId = null;
                v.driverName = null;
                v.driverPhone = null;
                v.driverLicense = null;
            }
        } else {
            if (body.containsKey("driverName")) v.driverName = Body.str(body, "driverName");
            if (body.containsKey("driverPhone")) v.driverPhone = Body.str(body, "driverPhone");
            if (body.containsKey("driverLicense")) v.driverLicense = Body.str(body, "driverLicense");
        }
    }
}
