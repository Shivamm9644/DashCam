package com.inurum.dashcam.controller;

import com.inurum.dashcam.dto.OdometerDto;
import com.inurum.dashcam.dto.PagedResponse;
import com.inurum.dashcam.dto.SafetyRecordingUrlResponse;
import com.inurum.dashcam.dto.truckercloud.*;
import com.inurum.dashcam.entity.*;
import com.inurum.dashcam.gateway.GatewayClient;
import com.inurum.dashcam.gateway.GatewayDevice;
import com.inurum.dashcam.repository.*;
import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.service.AccessService;
import com.inurum.dashcam.service.FleetService;
import com.inurum.dashcam.service.SafetyService;
import com.inurum.dashcam.web.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Dedicated, standardized TruckerCloud integration endpoints.
 * Guarantees validated 17-character VIN mapping, explicit ECU vs GPS odometer source provenance,
 * strict UTC ISO 8601 timestamps, standardized metric units, and documented video proof links.
 */
@RestController
@RequestMapping("/api/v1/integrations/truckercloud")
@Tag(name = "TruckerCloud Integration", description = "Enterprise read-only REST APIs for telematics aggregators (TruckerCloud)")
public class TruckerCloudIntegrationController {

    private final VehicleRepository vehicleRepository;
    private final DriverRepository driverRepository;
    private final GPSPositionRepository gpsPositionRepository;
    private final SafetyEventRepository safetyEventRepository;
    private final TripRepository tripRepository;
    private final TenantRepository tenantRepository;
    private final GatewayClient gatewayClient;
    private final AccessService accessService;
    private final SafetyService safetyService;

    public TruckerCloudIntegrationController(VehicleRepository vehicleRepository,
                                             DriverRepository driverRepository,
                                             GPSPositionRepository gpsPositionRepository,
                                             SafetyEventRepository safetyEventRepository,
                                             TripRepository tripRepository,
                                             TenantRepository tenantRepository,
                                             GatewayClient gatewayClient,
                                             AccessService accessService,
                                             SafetyService safetyService) {
        this.vehicleRepository = vehicleRepository;
        this.driverRepository = driverRepository;
        this.gpsPositionRepository = gpsPositionRepository;
        this.safetyEventRepository = safetyEventRepository;
        this.tripRepository = tripRepository;
        this.tenantRepository = tenantRepository;
        this.gatewayClient = gatewayClient;
        this.accessService = accessService;
        this.safetyService = safetyService;
    }

    @GetMapping("/vehicles")
    @Operation(summary = "List vehicles with validated 17-char VIN, paired DashCam, driver and odometer")
    public PagedResponse<TruckerCloudVehicleDto> getVehicles(
            HttpServletRequest req,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        CurrentUser user = CurrentUser.from(req);
        Pageable pageable = PageRequest.of(page, Math.min(size, 200), Sort.by(Sort.Direction.ASC, "plateNumber"));

        Page<VehicleEntity> vehiclePage = user.isSuperAdmin()
                ? vehicleRepository.findAll(pageable)
                : vehicleRepository.findByTenantId(user.tenantId(), pageable);

        Map<String, GatewayDevice> devices = gatewayClient.devices();
        Map<String, String> tenantNames = getTenantNames();

        List<TruckerCloudVehicleDto> dtos = vehiclePage.getContent().stream()
                .map(v -> toVehicleDto(v, devices, tenantNames))
                .toList();

        return PagedResponse.of(dtos, pageable.getPageNumber(), pageable.getPageSize(), vehiclePage.getTotalElements());
    }

    @GetMapping("/vehicles/{id}")
    @Operation(summary = "Get vehicle details by ID or 17-character VIN")
    public TruckerCloudVehicleDto getVehicle(HttpServletRequest req, @PathVariable String id) {
        CurrentUser user = CurrentUser.from(req);

        // Allow lookup by internal ID or 17-char VIN
        VehicleEntity v = vehicleRepository.findById(id)
                .or(() -> vehicleRepository.findByVin(id))
                .orElse(null);

        if (v == null || (!user.isSuperAdmin() && !v.tenantId.equals(user.tenantId()))) {
            throw ApiException.notFound("VEHICLE_NOT_FOUND", "Vehicle not found by ID or VIN: " + id);
        }

        Map<String, GatewayDevice> devices = gatewayClient.devices();
        Map<String, String> tenantNames = getTenantNames();
        return toVehicleDto(v, devices, tenantNames);
    }

    @GetMapping("/drivers")
    @Operation(summary = "List drivers with license information and assigned vehicles")
    public PagedResponse<TruckerCloudDriverDto> getDrivers(
            HttpServletRequest req,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        CurrentUser user = CurrentUser.from(req);
        Pageable pageable = PageRequest.of(page, Math.min(size, 200), Sort.by(Sort.Direction.ASC, "name"));

        Page<DriverEntity> driverPage = user.isSuperAdmin()
                ? driverRepository.findAll(pageable)
                : driverRepository.findByTenantId(user.tenantId(), pageable);

        Map<String, VehicleEntity> vehiclesMap = new HashMap<>();
        for (VehicleEntity v : vehicleRepository.findAll()) {
            vehiclesMap.put(v.id, v);
        }

        List<TruckerCloudDriverDto> dtos = driverPage.getContent().stream()
                .map(d -> toDriverDto(d, vehiclesMap.get(d.assignedVehicleId)))
                .toList();

        return PagedResponse.of(dtos, pageable.getPageNumber(), pageable.getPageSize(), driverPage.getTotalElements());
    }

    @GetMapping("/drivers/{id}")
    @Operation(summary = "Get driver details by ID")
    public TruckerCloudDriverDto getDriver(HttpServletRequest req, @PathVariable String id) {
        CurrentUser user = CurrentUser.from(req);
        DriverEntity d = driverRepository.findById(id).orElse(null);
        if (d == null || (!user.isSuperAdmin() && !d.tenantId.equals(user.tenantId()))) {
            throw ApiException.notFound("DRIVER_NOT_FOUND", "Driver not found: " + id);
        }
        VehicleEntity v = d.assignedVehicleId != null ? vehicleRepository.findById(d.assignedVehicleId).orElse(null) : null;
        return toDriverDto(d, v);
    }

    @GetMapping("/telemetry/latest")
    @Operation(summary = "Get latest GPS position and telematics for fleet vehicles (includes VIN and odometer source)")
    public List<TruckerCloudTelemetryDto> getLatestTelemetry(
            HttpServletRequest req,
            @RequestParam(required = false) String vin,
            @RequestParam(required = false) String terminalId) {

        CurrentUser user = CurrentUser.from(req);
        Map<String, GatewayDevice> devices = gatewayClient.devices();
        List<VehicleEntity> vList = accessService.visibleVehicles(user);

        List<TruckerCloudTelemetryDto> results = new ArrayList<>();
        Instant now = Instant.now();

        for (VehicleEntity v : vList) {
            if (vin != null && !vin.equalsIgnoreCase(v.vin)) continue;
            if (terminalId != null && !terminalId.equals(v.assignedDeviceId)) continue;

            GatewayDevice d = v.assignedDeviceId != null ? devices.get(v.assignedDeviceId) : null;
            if (d == null || !d.online() || !d.hasGpsFix()) continue;

            String odoSource = v.odometerSource != null ? v.odometerSource : "GPS_ESTIMATED";
            Double odoVal = v.odometerKm != null ? v.odometerKm : 0.0;

            results.add(new TruckerCloudTelemetryDto(
                    v.id,
                    v.vin,
                    v.plateNumber,
                    v.imei != null ? v.imei : d.simNo(),
                    d.terminalId(),
                    d.lastOnline() != null ? d.lastOnline() : now,
                    d.lat(),
                    d.lng(),
                    d.speed(),
                    0.0,
                    0.0,
                    true,
                    OdometerDto.of(odoVal, odoSource)
            ));
        }

        return results;
    }

    @GetMapping("/telemetry/history")
    @Operation(summary = "Get historical GPS breadcrumbs filtered by VIN, terminal ID, time range and pagination")
    public PagedResponse<TruckerCloudTelemetryDto> getHistoricalTelemetry(
            HttpServletRequest req,
            @Parameter(description = "17-character VIN") @RequestParam(required = false) String vin,
            @Parameter(description = "DashCam terminal ID") @RequestParam(required = false) String terminalId,
            @Parameter(description = "Start timestamp (UTC ISO 8601)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startTime,
            @Parameter(description = "End timestamp (UTC ISO 8601)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endTime,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {

        CurrentUser user = CurrentUser.from(req);
        Pageable pageable = PageRequest.of(page, Math.min(size, 1000), Sort.by(Sort.Direction.DESC, "timestamp"));

        Instant end = endTime != null ? endTime : Instant.now();
        Instant start = startTime != null ? startTime : end.minus(24, ChronoUnit.HOURS);

        Page<GPSPositionEntity> positionPage;

        if (vin != null && !vin.isBlank()) {
            VehicleEntity v = vehicleRepository.findByVin(vin.trim().toUpperCase())
                    .orElseThrow(() -> ApiException.notFound("VIN_NOT_FOUND", "Vehicle not found with VIN: " + vin));
            if (!user.isSuperAdmin() && !v.tenantId.equals(user.tenantId())) {
                throw ApiException.forbidden("ACCESS_DENIED", "You do not have access to this vehicle.");
            }
            positionPage = gpsPositionRepository.findByVehicleIdAndTimestampBetweenOrderByTimestampDesc(v.id, start, end, pageable);
        } else if (terminalId != null && !terminalId.isBlank()) {
            accessService.requireTerminal(user, terminalId);
            positionPage = gpsPositionRepository.findByTerminalIdAndTimestampBetweenOrderByTimestampDesc(terminalId, start, end, pageable);
        } else {
            positionPage = user.isSuperAdmin()
                    ? gpsPositionRepository.findAll(pageable)
                    : gpsPositionRepository.findByTenantIdAndTimestampBetweenOrderByTimestampDesc(user.tenantId(), start, end, pageable);
        }

        Map<String, VehicleEntity> byId = new HashMap<>();
        Map<String, VehicleEntity> byTerminal = new HashMap<>();
        for (VehicleEntity v : vehicleRepository.findAll()) {
            byId.put(v.id, v);
            if (v.assignedDeviceId != null) byTerminal.put(v.assignedDeviceId, v);
        }

        List<TruckerCloudTelemetryDto> dtos = positionPage.getContent().stream().map(p -> {
            VehicleEntity v = p.vehicleId != null ? byId.get(p.vehicleId) : byTerminal.get(p.terminalId);
            return new TruckerCloudTelemetryDto(
                    p.vehicleId != null ? p.vehicleId : (v != null ? v.id : null),
                    v != null ? v.vin : null,
                    v != null ? v.plateNumber : null,
                    v != null && v.imei != null ? v.imei : null,
                    p.terminalId,
                    p.timestamp,
                    p.lat,
                    p.lng,
                    p.speed,
                    p.heading,
                    p.altitude,
                    p.ignition,
                    OdometerDto.of(p.odometerKm != null ? p.odometerKm : (v != null ? v.odometerKm : 0.0),
                            p.odometerSource != null ? p.odometerSource : "GPS_ESTIMATED")
            );
        }).toList();

        return PagedResponse.of(dtos, pageable.getPageNumber(), pageable.getPageSize(), positionPage.getTotalElements());
    }

    @GetMapping("/safety/events")
    @Operation(summary = "List safety events with vehicle VIN, driver, odometer and video availability")
    public PagedResponse<TruckerCloudSafetyEventDto> getSafetyEvents(
            HttpServletRequest req,
            @RequestParam(required = false) String vin,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endTime,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        CurrentUser user = CurrentUser.from(req);
        Pageable pageable = PageRequest.of(page, Math.min(size, 200), Sort.by(Sort.Direction.DESC, "timestamp"));

        Page<SafetyEventEntity> eventPage = user.isSuperAdmin()
                ? safetyEventRepository.findAllByOrderByTimestampDesc(pageable)
                : safetyEventRepository.findByTenantIdOrderByTimestampDesc(user.tenantId(), pageable);

        Map<String, VehicleEntity> byTerminal = safetyService.vehiclesByTerminal();

        List<TruckerCloudSafetyEventDto> dtos = eventPage.getContent().stream()
                .filter(e -> vin == null || (e.vin != null && e.vin.equalsIgnoreCase(vin)))
                .filter(e -> eventType == null || e.type.equalsIgnoreCase(eventType))
                .filter(e -> severity == null || e.severity.equalsIgnoreCase(severity))
                .filter(e -> startTime == null || !e.timestamp.isBefore(startTime))
                .filter(e -> endTime == null || !e.timestamp.isAfter(endTime))
                .map(e -> toSafetyEventDto(e, byTerminal.get(e.terminalId)))
                .toList();

        return PagedResponse.of(dtos, pageable.getPageNumber(), pageable.getPageSize(), eventPage.getTotalElements());
    }

    @GetMapping("/safety/events/{id}")
    @Operation(summary = "Get single safety event by ID")
    public TruckerCloudSafetyEventDto getSafetyEvent(HttpServletRequest req, @PathVariable String id) {
        CurrentUser user = CurrentUser.from(req);
        SafetyEventEntity e = safetyService.require(user, id);
        VehicleEntity v = vehicleRepository.findByAssignedDeviceId(e.terminalId).orElse(null);
        return toSafetyEventDto(e, v);
    }

    @GetMapping("/safety/recording-url")
    @Operation(summary = "Get documented video proof URLs (HLS streams, media status, and expiration) for a safety event")
    public TruckerCloudRecordingUrlDto getRecordingUrl(HttpServletRequest req, @RequestParam String eventId) {
        SafetyRecordingUrlResponse resp = safetyService.getRecordingUrl(CurrentUser.from(req), eventId);
        return new TruckerCloudRecordingUrlDto(
                resp.eventId(),
                resp.vehicleId(),
                resp.vin(),
                resp.mediaStatus(),
                resp.videoUrl(),
                resp.roadUrl(),
                resp.cabinUrl(),
                resp.format(),
                resp.expiresAt(),
                resp.message()
        );
    }

    @GetMapping("/trips")
    @Operation(summary = "List trips with date-range filters, VIN, distance in km and odometer readings")
    public PagedResponse<TruckerCloudTripDto> getTrips(
            HttpServletRequest req,
            @RequestParam(required = false) String vin,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        CurrentUser user = CurrentUser.from(req);
        Pageable pageable = PageRequest.of(page, Math.min(size, 200), Sort.by(Sort.Direction.DESC, "startTime"));

        Page<TripEntity> tripPage;
        if (startDate != null && endDate != null) {
            tripPage = user.isSuperAdmin()
                    ? tripRepository.findByStartTimeBetweenOrderByStartTimeDesc(startDate, endDate, pageable)
                    : tripRepository.findByTenantIdAndStartTimeBetweenOrderByStartTimeDesc(user.tenantId(), startDate, endDate, pageable);
        } else {
            tripPage = user.isSuperAdmin()
                    ? tripRepository.findAllByOrderByStartTimeDesc(pageable)
                    : tripRepository.findByTenantIdOrderByStartTimeDesc(user.tenantId(), pageable);
        }

        Map<String, VehicleEntity> byTerminal = new HashMap<>();
        for (VehicleEntity v : vehicleRepository.findAll()) {
            if (v.assignedDeviceId != null) byTerminal.put(v.assignedDeviceId, v);
        }

        List<TruckerCloudTripDto> dtos = tripPage.getContent().stream()
                .filter(t -> {
                    if (vin == null) return true;
                    VehicleEntity v = byTerminal.get(t.terminalId);
                    return (t.vin != null && t.vin.equalsIgnoreCase(vin)) || (v != null && vin.equalsIgnoreCase(v.vin));
                })
                .map(t -> toTripDto(t, byTerminal.get(t.terminalId)))
                .toList();

        return PagedResponse.of(dtos, pageable.getPageNumber(), pageable.getPageSize(), tripPage.getTotalElements());
    }

    private TruckerCloudVehicleDto toVehicleDto(VehicleEntity v, Map<String, GatewayDevice> devices, Map<String, String> tenantNames) {
        GatewayDevice d = v.assignedDeviceId != null ? devices.get(v.assignedDeviceId) : null;
        String odoSource = v.odometerSource != null ? v.odometerSource : "GPS_ESTIMATED";
        Double odoVal = v.odometerKm != null ? v.odometerKm : 0.0;

        return new TruckerCloudVehicleDto(
                v.id,
                v.vin,
                v.plateNumber,
                v.imei != null ? v.imei : (d != null ? d.simNo() : null),
                v.assignedDeviceId,
                v.model != null && v.model.contains(" ") ? v.model.split(" ")[0] : null,
                v.model,
                v.year,
                v.tenantId,
                tenantNames.getOrDefault(v.tenantId, v.tenantId),
                v.driverId,
                v.driverName,
                v.driverLicense,
                FleetService.status(v, d),
                OdometerDto.of(odoVal, odoSource),
                d != null ? d.lastOnline() : null
        );
    }

    private TruckerCloudDriverDto toDriverDto(DriverEntity d, VehicleEntity v) {
        return new TruckerCloudDriverDto(
                d.id,
                d.name,
                d.licenseNumber,
                d.licenseState,
                d.phone,
                d.email,
                d.status,
                d.assignedVehicleId,
                v != null ? v.vin : null,
                v != null ? v.plateNumber : null,
                d.tenantId,
                d.createdAt
        );
    }

    private TruckerCloudSafetyEventDto toSafetyEventDto(SafetyEventEntity e, VehicleEntity v) {
        String odoSource = e.odometerSource != null ? e.odometerSource : (v != null ? v.odometerSource : "GPS_ESTIMATED");
        Double odoVal = e.odometerKm != null ? e.odometerKm : (v != null ? v.odometerKm : 0.0);

        return new TruckerCloudSafetyEventDto(
                e.id,
                e.vehicleId != null ? e.vehicleId : (v != null ? v.id : null),
                e.vin != null ? e.vin : (v != null ? v.vin : null),
                v != null ? v.plateNumber : e.terminalId,
                v != null ? v.imei : null,
                e.driverId != null ? e.driverId : (v != null ? v.driverId : null),
                e.driverName != null ? e.driverName : (v != null ? v.driverName : null),
                e.type,
                e.severity,
                e.timestamp,
                e.channel,
                e.lat,
                e.lng,
                e.speed,
                OdometerDto.of(odoVal, odoSource),
                e.mediaStatus != null ? e.mediaStatus : "STORED_ON_SD",
                e.roadChannelUrl != null ? e.roadChannelUrl : e.videoUrl,
                e.cabinChannelUrl,
                e.mediaExpiresAt
        );
    }

    private TruckerCloudTripDto toTripDto(TripEntity t, VehicleEntity v) {
        String odoSource = t.odometerSource != null ? t.odometerSource : (v != null ? v.odometerSource : "GPS_ESTIMATED");
        return new TruckerCloudTripDto(
                t.id,
                t.vehicleId != null ? t.vehicleId : (v != null ? v.id : null),
                t.vin != null ? t.vin : (v != null ? v.vin : null),
                v != null ? v.plateNumber : t.terminalId,
                t.driverId != null ? t.driverId : (v != null ? v.driverId : null),
                t.driverName != null ? t.driverName : (v != null ? v.driverName : null),
                t.startTime,
                t.endTime,
                t.startLocation,
                t.endLocation,
                t.distanceKm,
                t.maxSpeedKmH,
                t.avgSpeedKmH,
                OdometerDto.of(t.startOdometerKm != null ? t.startOdometerKm : (v != null ? v.odometerKm : 0.0), odoSource),
                OdometerDto.of(t.endOdometerKm != null ? t.endOdometerKm : (v != null ? v.odometerKm : 0.0), odoSource),
                0
        );
    }

    private Map<String, String> getTenantNames() {
        Map<String, String> map = new HashMap<>();
        tenantRepository.findAll().forEach(t -> map.put(t.id, t.name));
        return map;
    }
}

