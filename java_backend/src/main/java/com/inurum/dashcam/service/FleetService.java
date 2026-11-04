package com.inurum.dashcam.service;

import com.inurum.dashcam.config.BootstrapInitializer;
import com.inurum.dashcam.dto.OdometerDto;
import com.inurum.dashcam.dto.VehicleDto;
import com.inurum.dashcam.entity.DiscoveredTerminalEntity;
import com.inurum.dashcam.entity.GPSPositionEntity;
import com.inurum.dashcam.entity.VehicleEntity;
import com.inurum.dashcam.gateway.GatewayClient;
import com.inurum.dashcam.gateway.GatewayDevice;
import com.inurum.dashcam.repository.DiscoveredTerminalRepository;
import com.inurum.dashcam.repository.GPSPositionRepository;
import com.inurum.dashcam.repository.TenantRepository;
import com.inurum.dashcam.repository.VehicleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

import static com.inurum.dashcam.web.Json.obj;

/**
 * Vehicles as the dashboard and APIs show them: the stored vehicle merged with the camera's live state
 * from the gateway. Includes validated VIN mapping, odometer data provenance, and GPS breadcrumb persistence.
 */
@Service
public class FleetService {

    private static final Logger log = LoggerFactory.getLogger(FleetService.class);

    public static final List<Map<String, Object>> CHANNELS = List.of(
            obj("channelId", 1, "name", "Road Facing (CH1)"),
            obj("channelId", 2, "name", "Driver Cabin (CH2)"));

    private final VehicleRepository vehicleRepository;
    private final DiscoveredTerminalRepository discoveredRepository;
    private final TenantRepository tenantRepository;
    private final GatewayClient gateway;
    private final AuditService audit;
    private final GPSPositionRepository gpsPositionRepository;

    // Throttle GPS persistence to at most once per 10 seconds per device to avoid bloating DB
    private final Map<String, Long> lastGpsPersist = new ConcurrentHashMap<>();

    public FleetService(VehicleRepository vehicleRepository, DiscoveredTerminalRepository discoveredRepository,
                        TenantRepository tenantRepository, GatewayClient gateway, AuditService audit,
                        GPSPositionRepository gpsPositionRepository) {
        this.vehicleRepository = vehicleRepository;
        this.discoveredRepository = discoveredRepository;
        this.tenantRepository = tenantRepository;
        this.gateway = gateway;
        this.audit = audit;
        this.gpsPositionRepository = gpsPositionRepository;
    }

    /** ONLINE, OFFLINE (camera not connected or no camera paired) or DEACTIVATED */
    public static String status(VehicleEntity v, GatewayDevice d) {
        if (!v.active) return "DEACTIVATED";
        return d != null && d.online() ? "ONLINE" : "OFFLINE";
    }

    public Map<String, Object> view(VehicleEntity v, Map<String, GatewayDevice> devices, Map<String, String> tenantNames) {
        GatewayDevice d = v.assignedDeviceId == null ? null : devices.get(v.assignedDeviceId);
        boolean online = d != null && d.online() && v.active;
        boolean fix = online && d.hasGpsFix();

        String odoSource = v.odometerSource != null ? v.odometerSource : "GPS_ESTIMATED";
        Double odoVal = v.odometerKm != null ? v.odometerKm : 0.0;
        Map<String, Object> odoMap = obj(
                "value", odoVal,
                "unit", "km",
                "source", odoSource
        );

        return obj(
                "id", v.id,
                "tenantId", v.tenantId,
                "tenantName", tenantNames.getOrDefault(v.tenantId, v.tenantId),
                "plateNumber", v.plateNumber,
                "vin", v.vin,
                "imei", v.imei != null ? v.imei : (d != null && d.simNo() != null ? d.simNo() : null),
                "label", v.label != null ? v.label : v.plateNumber,
                "model", v.model,
                "year", v.year,
                "driverId", v.driverId,
                "driverName", v.driverName,
                "driverPhone", v.driverPhone,
                "driverLicense", v.driverLicense,
                "odometer", odoMap,
                "odometerKm", odoVal,
                "odometerSource", odoSource,
                "assignedDeviceId", v.assignedDeviceId,
                "terminalId", v.assignedDeviceId,
                "dashcamModel", d != null ? d.deviceType() : null,
                "status", status(v, d),
                "speed", online ? d.speed() : 0,
                "heading", 0,
                "lat", fix ? d.lat() : null,
                "lng", fix ? d.lng() : null,
                "hasGpsFix", fix,
                "address", fix ? null : (online ? "No GPS fix" : null),
                "ignition", online,
                "lastSeen", d != null ? d.lastOnline() : null,
                "channels", CHANNELS,
                "autoDiscovered", v.autoDiscovered,
                "createdAt", v.createdAt);
    }

    public VehicleDto toDto(VehicleEntity v, Map<String, GatewayDevice> devices, Map<String, String> tenantNames) {
        GatewayDevice d = v.assignedDeviceId == null ? null : devices.get(v.assignedDeviceId);
        boolean online = d != null && d.online() && v.active;
        boolean fix = online && d.hasGpsFix();

        String odoSource = v.odometerSource != null ? v.odometerSource : "GPS_ESTIMATED";
        Double odoVal = v.odometerKm != null ? v.odometerKm : 0.0;

        return new VehicleDto(
                v.id,
                v.tenantId,
                tenantNames.getOrDefault(v.tenantId, v.tenantId),
                v.plateNumber,
                v.vin,
                v.imei != null ? v.imei : (d != null ? d.simNo() : null),
                v.label != null ? v.label : v.plateNumber,
                v.model,
                v.year,
                v.driverId,
                v.driverName,
                v.driverPhone,
                v.driverLicense,
                v.assignedDeviceId,
                v.assignedDeviceId,
                d != null ? d.deviceType() : null,
                status(v, d),
                online ? d.speed() : 0.0,
                0.0,
                fix ? d.lat() : null,
                fix ? d.lng() : null,
                fix,
                fix ? null : (online ? "No GPS fix" : null),
                online,
                OdometerDto.of(odoVal, odoSource),
                d != null ? d.lastOnline() : null,
                CHANNELS,
                v.autoDiscovered,
                v.createdAt
        );
    }

    public List<Map<String, Object>> views(List<VehicleEntity> vehicles) {
        Map<String, GatewayDevice> devices = gateway.devices();
        Map<String, String> names = new HashMap<>();
        tenantRepository.findAll().forEach(t -> names.put(t.id, t.name));
        List<Map<String, Object>> out = new ArrayList<>();
        for (VehicleEntity v : vehicles) {
            out.add(view(v, devices, names));
        }
        return out;
    }

    public Map<String, Object> viewOne(VehicleEntity v) {
        Map<String, GatewayDevice> devices = gateway.devices();
        Map<String, String> names = new HashMap<>();
        tenantRepository.findById(v.tenantId).ifPresent(t -> names.put(t.id, t.name));
        return view(v, devices, names);
    }

    public VehicleDto getDto(VehicleEntity v) {
        Map<String, GatewayDevice> devices = gateway.devices();
        Map<String, String> names = new HashMap<>();
        tenantRepository.findById(v.tenantId).ifPresent(t -> names.put(t.id, t.name));
        return toDto(v, devices, names);
    }

    /**
     * Periodically save current GPS positions of active cameras to gps_positions table.
     * Runs every 10 seconds.
     */
    @Scheduled(initialDelay = 15_000, fixedDelay = 10_000)
    public void persistGpsTelemetry() {
        if (!gateway.isReachable()) return;
        Map<String, GatewayDevice> devices = gateway.devices();
        if (devices.isEmpty()) return;

        Map<String, VehicleEntity> byTerminal = new HashMap<>();
        for (VehicleEntity v : vehicleRepository.findAll()) {
            if (v.assignedDeviceId != null) byTerminal.put(v.assignedDeviceId, v);
        }

        long now = System.currentTimeMillis();
        for (GatewayDevice d : devices.values()) {
            if (!d.online() || !d.hasGpsFix()) continue;

            Long last = lastGpsPersist.get(d.terminalId());
            if (last != null && now - last < 10_000) continue; // at most every 10s per device
            lastGpsPersist.put(d.terminalId(), now);

            VehicleEntity v = byTerminal.get(d.terminalId());

            GPSPositionEntity pos = new GPSPositionEntity();
            pos.terminalId = d.terminalId();
            pos.vehicleId = v != null ? v.id : null;
            pos.tenantId = v != null ? v.tenantId : BootstrapInitializer.PLATFORM_TENANT_ID;
            pos.timestamp = d.lastOnline() != null ? d.lastOnline() : Instant.now();
            pos.lat = d.lat();
            pos.lng = d.lng();
            pos.speed = d.speed();
            pos.heading = 0.0;
            pos.altitude = 0.0;
            pos.odometerKm = v != null ? v.odometerKm : null;
            pos.odometerSource = v != null ? v.odometerSource : "GPS_ESTIMATED";
            pos.ignition = true;
            pos.validFix = true;
            pos.recordedAt = Instant.now();

            try {
                gpsPositionRepository.save(pos);
            } catch (Exception e) {
                log.debug("Failed to record GPS telemetry: {}", e.getMessage());
            }
        }
    }

    /**
     * A camera connected to the gateway for the first time: add a vehicle for it in the platform
     * tenant so it appears on the dashboard. Admins rename/move it later.
     */
    @Scheduled(initialDelay = 1_000, fixedDelay = 15_000)
    public void discoverNewCameras() {
        if (!tenantRepository.existsById(BootstrapInitializer.PLATFORM_TENANT_ID)) return;
        Map<String, GatewayDevice> devices = gateway.devices();
        if (!gateway.isReachable()) return;
        for (GatewayDevice d : devices.values()) {
            if (discoveredRepository.existsById(d.terminalId())) continue;
            discoveredRepository.save(new DiscoveredTerminalEntity(d.terminalId(), Instant.now()));
            if (vehicleRepository.findByAssignedDeviceId(d.terminalId()).isPresent()) continue;

            VehicleEntity v = new VehicleEntity();
            v.id = "veh-auto-" + d.terminalId();
            v.tenantId = BootstrapInitializer.PLATFORM_TENANT_ID;
            String plate = (d.vehicleNo() != null && !d.vehicleNo().isBlank() && !"-".equals(d.vehicleNo()))
                    ? d.vehicleNo()
                    : "CAM-" + (d.terminalId().length() > 6 ? d.terminalId().substring(d.terminalId().length() - 6) : d.terminalId());
            v.plateNumber = plate;
            v.label = (d.deviceType() != null && !d.deviceType().isBlank() ? d.deviceType() : "DashCam") + " (" + d.terminalId() + ")";
            v.assignedDeviceId = d.terminalId();
            v.imei = d.terminalId();
            v.model = d.deviceType();
            v.autoDiscovered = true;
            v.odometerKm = 0.0;
            v.odometerSource = "GPS_ESTIMATED";
            v.createdAt = Instant.now();
            vehicleRepository.save(v);
            audit.record("SYSTEM", v.tenantId, "AUTO_DISCOVER_DEVICE", v.id, Map.of("terminalId", d.terminalId()));
            log.info("Registered gateway dashcam {}; added vehicle {}", d.terminalId(), v.plateNumber);
        }
    }
}
