package com.inurum.dashcam.controller;

import com.inurum.dashcam.dto.GpsPositionDto;
import com.inurum.dashcam.dto.OdometerDto;
import com.inurum.dashcam.dto.PagedResponse;
import com.inurum.dashcam.entity.GPSPositionEntity;
import com.inurum.dashcam.entity.VehicleEntity;
import com.inurum.dashcam.gateway.GatewayClient;
import com.inurum.dashcam.gateway.GatewayDevice;
import com.inurum.dashcam.repository.GPSPositionRepository;
import com.inurum.dashcam.repository.VehicleRepository;
import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.service.AccessService;
import com.inurum.dashcam.web.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static com.inurum.dashcam.web.Json.obj;

/**
 * Camera telematics from the gateway and historical breadcrumbs:
 * GPS positions, odometer with source, connection health, and device diagnostics.
 */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Telemetry & device health", description = "Live and historical GPS telemetry, device health and diagnostics")
public class TelemetryController {

    private static final String NA = "Not Available";

    private final GatewayClient gateway;
    private final AccessService access;
    private final VehicleRepository vehicles;
    private final GPSPositionRepository gpsPositions;
    private final String publicHost;
    private final int jt808Port;
    private final int jt1078Port;

    public TelemetryController(GatewayClient gateway, AccessService access, VehicleRepository vehicles,
                               GPSPositionRepository gpsPositions,
                               @Value("${gateway.public-host}") String publicHost,
                               @Value("${gateway.jt808-port}") int jt808Port,
                               @Value("${gateway.jt1078-port}") int jt1078Port) {
        this.gateway = gateway;
        this.access = access;
        this.vehicles = vehicles;
        this.gpsPositions = gpsPositions;
        this.publicHost = publicHost;
        this.jt808Port = jt808Port;
        this.jt1078Port = jt1078Port;
    }

    @GetMapping("/positions/latest")
    @Operation(summary = "Latest GPS fix of every connected camera with VIN and odometer source")
    public Map<String, Object> positions(HttpServletRequest req, @RequestParam(required = false) String terminalId) {
        Map<String, GatewayDevice> devices = gateway.devices();
        List<Map<String, Object>> positions = new ArrayList<>();
        Instant now = Instant.now();

        for (VehicleEntity v : access.visibleVehicles(CurrentUser.from(req))) {
            GatewayDevice d = v.assignedDeviceId == null ? null : devices.get(v.assignedDeviceId);
            if (d == null || !d.online() || !d.hasGpsFix() || !v.active) continue;
            if (terminalId != null && !terminalId.equals(d.terminalId())) continue;

            String odoSource = v.odometerSource != null ? v.odometerSource : "GPS_ESTIMATED";
            Double odoVal = v.odometerKm != null ? v.odometerKm : 0.0;
            Map<String, Object> odoMap = obj(
                    "value", odoVal,
                    "unit", "km",
                    "source", odoSource
            );

            positions.add(obj(
                    "terminalId", d.terminalId(),
                    "vehicleId", v.id,
                    "plateNumber", v.plateNumber,
                    "vin", v.vin,
                    "lat", d.lat(),
                    "lng", d.lng(),
                    "speed", d.speed(),
                    "heading", 0,
                    "odometer", odoMap,
                    "ignition", true,
                    "timestamp", d.lastOnline() != null ? d.lastOnline() : now));
        }
        return obj("positions", positions, "total", positions.size(), "serverTime", now);
    }

    @GetMapping({"/telemetry/breadcrumbs", "/positions/history"})
    @Operation(summary = "Historical GPS breadcrumbs by terminal ID / vehicle ID, time range and pagination")
    public PagedResponse<GpsPositionDto> history(
            HttpServletRequest req,
            @RequestParam(required = false) String terminalId,
            @RequestParam(required = false) String vehicleId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endTime,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {

        CurrentUser user = CurrentUser.from(req);
        Pageable pageable = PageRequest.of(page, Math.min(size, 1000), Sort.by(Sort.Direction.DESC, "timestamp"));

        Instant end = endTime != null ? endTime : Instant.now();
        Instant start = startTime != null ? startTime : end.minus(24, ChronoUnit.HOURS);

        Page<GPSPositionEntity> positionPage;

        if (terminalId != null && !terminalId.isBlank()) {
            access.requireTerminal(user, terminalId);
            positionPage = gpsPositions.findByTerminalIdAndTimestampBetweenOrderByTimestampDesc(terminalId, start, end, pageable);
        } else if (vehicleId != null && !vehicleId.isBlank()) {
            VehicleEntity v = access.requireVehicle(user, vehicleId);
            positionPage = gpsPositions.findByVehicleIdAndTimestampBetweenOrderByTimestampDesc(v.id, start, end, pageable);
        } else {
            positionPage = user.isSuperAdmin()
                    ? gpsPositions.findAll(pageable)
                    : gpsPositions.findByTenantIdAndTimestampBetweenOrderByTimestampDesc(user.tenantId(), start, end, pageable);
        }

        Map<String, VehicleEntity> byId = new HashMap<>();
        Map<String, VehicleEntity> byTerminal = new HashMap<>();
        for (VehicleEntity v : vehicles.findAll()) {
            byId.put(v.id, v);
            if (v.assignedDeviceId != null) byTerminal.put(v.assignedDeviceId, v);
        }

        List<GpsPositionDto> items = positionPage.getContent().stream().map(p -> {
            VehicleEntity v = p.vehicleId != null ? byId.get(p.vehicleId) : byTerminal.get(p.terminalId);
            return new GpsPositionDto(
                    p.terminalId,
                    p.vehicleId != null ? p.vehicleId : (v != null ? v.id : null),
                    v != null ? v.plateNumber : p.terminalId,
                    v != null ? v.vin : null,
                    p.lat,
                    p.lng,
                    p.speed,
                    p.heading,
                    p.altitude,
                    OdometerDto.of(p.odometerKm != null ? p.odometerKm : (v != null ? v.odometerKm : 0.0),
                            p.odometerSource != null ? p.odometerSource : "GPS_ESTIMATED"),
                    p.ignition,
                    p.timestamp
            );
        }).toList();

        return PagedResponse.of(items, pageable.getPageNumber(), pageable.getPageSize(), positionPage.getTotalElements());
    }

    @GetMapping("/devices/health")
    @Operation(summary = "Connection health of each dashcam; fields the camera does not report are 'Not Available'")
    public Map<String, Object> health(HttpServletRequest req) {
        CurrentUser user = CurrentUser.from(req);
        Map<String, GatewayDevice> devices = gateway.devices();
        Map<String, VehicleEntity> byTerminal = new HashMap<>();
        for (VehicleEntity v : vehicles.findAll()) {
            if (v.assignedDeviceId != null) byTerminal.put(v.assignedDeviceId, v);
        }

        Set<String> terminals = new LinkedHashSet<>(access.visibleTerminals(user));
        if (user.isSuperAdmin()) {
            for (GatewayDevice d : devices.values()) {
                if (d.online() || byTerminal.containsKey(d.terminalId())) terminals.add(d.terminalId());
            }
        }

        List<Map<String, Object>> list = new ArrayList<>();
        for (String id : terminals) {
            GatewayDevice d = devices.get(id);
            VehicleEntity v = byTerminal.get(id);
            boolean online = d != null && d.online();
            list.add(obj(
                    "terminalId", id,
                    "serialNumber", null,
                    "model", d != null ? d.deviceType() : null,
                    "tenantId", v != null ? v.tenantId : null,
                    "pairedVehicle", v != null ? obj("id", v.id, "plateNumber", v.plateNumber, "label", v.label, "vin", v.vin) : null,
                    "connectionStatus", online ? "CONNECTED" : "OFFLINE",
                    "jt808Socket", obj(
                            "port", jt808Port,
                            "protocol", "JT/T 808-2013",
                            "authenticated", online,
                            "lastHeartbeat", d != null ? d.lastOnline() : null,
                            "latencyMs", null),
                    "jt1078Media", obj(
                            "port", jt1078Port,
                            "protocol", "JT/T 1078-2016",
                            "ch1Status", online ? "READY" : "OFFLINE",
                            "ch2Status", online ? "READY" : "OFFLINE"),
                    "gpsTelemetry", obj(
                            "lastFix", d != null ? d.lastOnline() : null,
                            "satellites", NA,
                            "coordinates", online && d.hasGpsFix()
                                    ? String.format("%.5f, %.5f", d.lat(), d.lng())
                                    : (online ? "No GPS fix" : NA),
                            "speed", online ? d.speed() + " km/h" : NA,
                            "odometer", v != null && v.odometerKm != null ? v.odometerKm + " km (" + v.odometerSource + ")" : NA,
                            "ignition", online ? "ON" : NA),
                    "hardwareDiagnostics", obj(
                            "firmwareVersion", d != null && d.firmware() != null ? d.firmware() : NA,
                            "externalVoltage", NA,
                            "simNumber", d != null && d.simNo() != null ? d.simNo() : NA,
                            "signalStrength", NA,
                            "sdCardStatus", NA,
                            "temperature", NA)));
        }
        return obj("devices", list, "total", list.size(), "gatewayReachable", gateway.isReachable(), "serverTime", Instant.now());
    }

    @GetMapping("/live/device-status")
    @Operation(summary = "Whether a camera is connected to the gateway right now")
    public Map<String, Object> deviceStatus(HttpServletRequest req, @RequestParam String terminalId) {
        access.requireTerminal(CurrentUser.from(req), terminalId);
        GatewayDevice d = gateway.device(terminalId).orElse(null);
        return obj(
                "terminalId", terminalId,
                "online", d != null && d.online(),
                "lastOnline", d != null ? d.lastOnline() : null,
                "gatewayReachable", gateway.isReachable(),
                "checkedAt", Instant.now(),
                "gatewayHost", publicHost,
                "jt808Port", jt808Port);
    }
}
