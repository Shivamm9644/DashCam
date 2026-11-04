package com.inurum.dashcam.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.inurum.dashcam.dto.OdometerDto;
import com.inurum.dashcam.dto.SafetyEventDto;
import com.inurum.dashcam.dto.SafetyRecordingUrlResponse;
import com.inurum.dashcam.entity.SafetyEventEntity;
import com.inurum.dashcam.entity.VehicleEntity;
import com.inurum.dashcam.gateway.GatewayClient;
import com.inurum.dashcam.repository.SafetyEventRepository;
import com.inurum.dashcam.repository.VehicleRepository;
import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.web.ApiException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static com.inurum.dashcam.web.Json.obj;

/**
 * DashCam alarm events reported by hardware terminals (pulled from the gateway),
 * incident review triage, and video evidence retrieval.
 */
@Service
public class SafetyService {

    private static final Map<String, String> EVENT_TEXT = Map.ofEntries(
            Map.entry("EMERGENCY_SOS", "SOS / emergency alarm from the dashcam"),
            Map.entry("OVERSPEED", "Vehicle over the speed limit"),
            Map.entry("FATIGUE_DRIVING", "Driver fatigue detected"),
            Map.entry("DANGER_WARNING", "Danger warning from the dashcam"),
            Map.entry("COLLISION", "Collision detected by the dashcam"),
            Map.entry("ROLLOVER", "Rollover detected by the dashcam"),
            Map.entry("PHONE_CALL", "Driver using a phone"),
            Map.entry("SMOKING", "Driver smoking"),
            Map.entry("DISTRACTED_DRIVING", "Driver distracted"),
            Map.entry("FORWARD_COLLISION_WARNING", "Forward collision warning (ADAS)"),
            Map.entry("LANE_DEPARTURE", "Lane departure (ADAS)"),
            Map.entry("RAPID_ACCELERATION", "Rapid acceleration detected"),
            Map.entry("HARSH_BRAKING", "Harsh braking detected"),
            Map.entry("SHARP_TURN", "Sharp turn / harsh cornering detected"),
            Map.entry("VIDEO_SIGNAL_LOSS", "Camera video signal lost"),
            Map.entry("VIDEO_OCCLUSION", "Camera lens covered / blocked"),
            Map.entry("STORAGE_FAULT", "SD card / storage fault"),
            Map.entry("POWER_CUT", "Dashcam main power cut"),
            Map.entry("GNSS_MODULE_FAULT", "GPS module fault"),
            Map.entry("GNSS_ANTENNA_DISCONNECTED", "GPS antenna disconnected"));

    private static final Set<String> TRIAGE = Set.of("NEEDS_REVIEW", "COACHED", "RECOGNIZED", "DISMISSED");

    private final SafetyEventRepository events;
    private final VehicleRepository vehicles;
    private final AccessService access;
    private final GatewayClient gateway;
    private final AuditService audit;
    private volatile String lastSync;

    public SafetyService(SafetyEventRepository events, VehicleRepository vehicles, AccessService access,
                         GatewayClient gateway, AuditService audit) {
        this.events = events;
        this.vehicles = vehicles;
        this.access = access;
        this.gateway = gateway;
        this.audit = audit;
    }

    public List<SafetyEventEntity> visible(CurrentUser user) {
        Set<String> terminals = access.visibleTerminals(user);
        return events.findAllByOrderByTimestampDesc().stream()
                .filter(e -> user.isSuperAdmin() || terminals.contains(e.terminalId))
                .toList();
    }

    public SafetyEventEntity require(CurrentUser user, String id) {
        SafetyEventEntity e = events.findById(id).orElse(null);
        if (e == null || (!user.isSuperAdmin() && !access.visibleTerminals(user).contains(e.terminalId))) {
            throw ApiException.notFound("INCIDENT_NOT_FOUND", "Safety incident not found.");
        }
        return e;
    }

    @Transactional
    public SafetyEventEntity review(CurrentUser user, String id, String status, String notes, String category) {
        SafetyEventEntity e = require(user, id);
        String next = status == null ? "COACHED" : status.toUpperCase();
        if (!TRIAGE.contains(next)) throw ApiException.badRequest("BAD_STATUS", "status must be one of " + TRIAGE);
        e.triageStatus = next;
        e.reviewNotes = notes;
        e.coachingCategory = category;
        e.reviewedBy = user.email();
        e.reviewedAt = Instant.now();
        events.save(e);
        audit.record(user.id(), e.tenantId, "REVIEW_INCIDENT", e.id, Map.of("status", next));
        return e;
    }

    @Transactional
    public SafetyRecordingUrlResponse getRecordingUrl(CurrentUser user, String eventId) {
        SafetyEventEntity e = require(user, eventId);
        VehicleEntity v = vehicles.findByAssignedDeviceId(e.terminalId).orElse(null);

        Instant now = Instant.now();
        // Check if existing retrieved video link is still valid
        if ("READY".equalsIgnoreCase(e.mediaStatus) && e.videoUrl != null
                && e.mediaExpiresAt != null && e.mediaExpiresAt.isAfter(now)) {
            return new SafetyRecordingUrlResponse(
                    e.id,
                    e.terminalId,
                    e.vehicleId != null ? e.vehicleId : (v != null ? v.id : null),
                    e.vin != null ? e.vin : (v != null ? v.vin : null),
                    e.mediaStatus,
                    e.videoUrl,
                    e.roadChannelUrl != null ? e.roadChannelUrl : LiveService.streamUrl(e.terminalId, 1),
                    e.cabinChannelUrl != null ? e.cabinChannelUrl : LiveService.streamUrl(e.terminalId, 2),
                    "HLS",
                    e.mediaExpiresAt,
                    "Retrieved video proof is ready for streaming."
            );
        }

        // Camera must be connected to request playback from SD card
        boolean online = gateway.isOnline(e.terminalId);
        String roadUrl = LiveService.streamUrl(e.terminalId, 1);
        String cabinUrl = LiveService.streamUrl(e.terminalId, 2);
        String primaryUrl = e.channel != null && e.channel == 2 ? cabinUrl : roadUrl;
        Instant expiresAt = now.plus(Duration.ofHours(4));

        if (online) {
            // Trigger hardware playback around event timestamp (20 seconds window)
            try {
                Instant startWindow = e.timestamp.minusSeconds(10);
                Instant endWindow = e.timestamp.plusSeconds(20);
                String startStr = startWindow.toString().substring(0, 19).replace('T', ' ');
                String endStr = endWindow.toString().substring(0, 19).replace('T', ' ');

                gateway.playbackStart(e.terminalId, e.channel != null ? String.valueOf(e.channel) : "1", startStr, endStr);
                e.mediaStatus = "READY";
                e.videoUrl = primaryUrl;
                e.roadChannelUrl = roadUrl;
                e.cabinChannelUrl = cabinUrl;
                e.mediaExpiresAt = expiresAt;
                events.save(e);

                audit.record(user.id(), e.tenantId, "RETRIEVE_INCIDENT_VIDEO", e.id,
                        Map.of("terminalId", e.terminalId, "videoUrl", primaryUrl));

                return new SafetyRecordingUrlResponse(
                        e.id,
                        e.terminalId,
                        e.vehicleId != null ? e.vehicleId : (v != null ? v.id : null),
                        e.vin != null ? e.vin : (v != null ? v.vin : null),
                        "READY",
                        primaryUrl,
                        roadUrl,
                        cabinUrl,
                        "HLS",
                        expiresAt,
                        "Video clip retrieved from DashCam MicroSD and streaming via HLS."
                );
            } catch (Exception ex) {
                // If playback initiation failed, inform caller that media is on SD
            }
        }

        return new SafetyRecordingUrlResponse(
                e.id,
                e.terminalId,
                e.vehicleId != null ? e.vehicleId : (v != null ? v.id : null),
                e.vin != null ? e.vin : (v != null ? v.vin : null),
                "STORED_ON_SD",
                null,
                null,
                null,
                "HLS",
                null,
                online ? "Clip is stored on DashCam SD card; retrieve via /api/v1/video/retrieve" : "DashCam is currently offline; clip remains stored on local SD card"
        );
    }

    public Map<String, Object> view(SafetyEventEntity e, Map<String, VehicleEntity> byTerminal) {
        VehicleEntity v = byTerminal.get(e.terminalId);
        String odoSource = e.odometerSource != null ? e.odometerSource : (v != null ? v.odometerSource : "GPS_ESTIMATED");
        Double odoVal = e.odometerKm != null ? e.odometerKm : (v != null ? v.odometerKm : 0.0);

        Map<String, Object> odoMap = obj(
                "value", odoVal,
                "unit", "km",
                "source", odoSource
        );

        String mediaStatus = e.mediaStatus != null ? e.mediaStatus : "STORED_ON_SD";

        return obj(
                "id", e.id,
                "tenantId", e.tenantId,
                "terminalId", e.terminalId,
                "vehicleId", e.vehicleId != null ? e.vehicleId : (v != null ? v.id : null),
                "vin", e.vin != null ? e.vin : (v != null ? v.vin : null),
                "vehiclePlate", v != null ? v.plateNumber : e.terminalId,
                "plateNumber", v != null ? v.plateNumber : e.terminalId,
                "driverId", e.driverId != null ? e.driverId : (v != null ? v.driverId : null),
                "driverName", e.driverName != null ? e.driverName : (v != null ? v.driverName : null),
                "type", e.type,
                "eventType", e.type,
                "severity", e.severity,
                "timestamp", e.timestamp,
                "channel", e.channel,
                "lat", e.lat,
                "lng", e.lng,
                "speed", e.speed,
                "odometer", odoMap,
                "odometerKm", odoVal,
                "odometerSource", odoSource,
                "description", e.description,
                "triageStatus", e.triageStatus,
                "status", e.triageStatus,
                "coached", "COACHED".equals(e.triageStatus),
                "coachingCategory", e.coachingCategory,
                "coachedBy", e.reviewedBy,
                "notes", e.reviewNotes,
                "mediaState", mediaStatus,
                "mediaStatus", mediaStatus,
                "videoUrl", e.videoUrl,
                "roadChannelUrl", e.roadChannelUrl,
                "cabinChannelUrl", e.cabinChannelUrl,
                "mediaExpiresAt", e.mediaExpiresAt);
    }

    public SafetyEventDto toDto(SafetyEventEntity e, Map<String, VehicleEntity> byTerminal) {
        VehicleEntity v = byTerminal.get(e.terminalId);
        String odoSource = e.odometerSource != null ? e.odometerSource : (v != null ? v.odometerSource : "GPS_ESTIMATED");
        Double odoVal = e.odometerKm != null ? e.odometerKm : (v != null ? v.odometerKm : 0.0);

        return new SafetyEventDto(
                e.id,
                e.tenantId,
                e.terminalId,
                e.vehicleId != null ? e.vehicleId : (v != null ? v.id : null),
                e.vin != null ? e.vin : (v != null ? v.vin : null),
                v != null ? v.plateNumber : e.terminalId,
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
                e.description,
                e.triageStatus,
                e.coachingCategory,
                e.reviewNotes,
                e.reviewedBy,
                e.mediaStatus != null ? e.mediaStatus : "STORED_ON_SD",
                e.videoUrl,
                e.roadChannelUrl,
                e.cabinChannelUrl,
                e.mediaExpiresAt
        );
    }

    public Map<String, VehicleEntity> vehiclesByTerminal() {
        Map<String, VehicleEntity> m = new HashMap<>();
        for (VehicleEntity v : vehicles.findAll()) {
            if (v.assignedDeviceId != null) m.put(v.assignedDeviceId, v);
        }
        return m;
    }

    /** Pulls new alarm events from the gateway, for cameras that are in the fleet */
    @Scheduled(initialDelay = 20_000, fixedDelay = 10_000)
    public void syncFromGateway() {
        Map<String, VehicleEntity> fleet = vehiclesByTerminal();
        for (JsonNode g : gateway.events(lastSync)) {
            String id = g.path("id").asText(null), terminalId = g.path("terminalId").asText(null);
            String type = g.path("type").asText(null), ts = g.path("timestamp").asText(null);
            if (id == null || terminalId == null || type == null || ts == null) continue;
            Instant at;
            try {
                at = Instant.parse(ts);
            } catch (Exception badTime) {
                continue;
            }
            if (lastSync == null || ts.compareTo(lastSync) > 0) lastSync = ts;
            VehicleEntity v = fleet.get(terminalId);
            if (v == null || events.existsById(id)) continue;

            SafetyEventEntity e = new SafetyEventEntity();
            e.id = id;
            e.tenantId = v.tenantId;
            e.terminalId = terminalId;
            e.vehicleId = v.id;
            e.vin = v.vin;
            e.driverId = v.driverId;
            e.driverName = v.driverName;
            e.type = type;
            e.severity = g.path("severity").asText("MAJOR");
            e.timestamp = at;
            e.channel = g.hasNonNull("channel") ? g.get("channel").asInt() : null;
            e.lat = g.hasNonNull("lat") ? g.get("lat").asDouble() : null;
            e.lng = g.hasNonNull("lng") ? g.get("lng").asDouble() : null;
            e.speed = g.hasNonNull("speed") ? g.get("speed").asDouble() : null;
            e.odometerKm = v.odometerKm;
            e.odometerSource = v.odometerSource != null ? v.odometerSource : "GPS_ESTIMATED";
            e.description = EVENT_TEXT.getOrDefault(type, type.replace('_', ' ')) + (e.channel != null ? " (CH" + e.channel + ")" : "");
            e.triageStatus = "NEEDS_REVIEW";
            e.mediaStatus = "STORED_ON_SD";
            events.save(e);
        }
    }
}
