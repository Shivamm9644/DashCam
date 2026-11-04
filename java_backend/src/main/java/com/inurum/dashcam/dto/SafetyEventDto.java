package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "DashCam safety event / incident with complete vehicle and media association")
public record SafetyEventDto(
        @Schema(description = "Unique event identifier", example = "evt-20261102-001")
        String id,

        @Schema(description = "Tenant ID", example = "tenant-inurum")
        String tenantId,

        @Schema(description = "DashCam terminal ID", example = "018800123456")
        String terminalId,

        @Schema(description = "Vehicle ID", example = "veh-8a7b9c1d")
        String vehicleId,

        @Schema(description = "17-character VIN", example = "1HD1KAE12FB012345")
        String vin,

        @Schema(description = "Vehicle license plate", example = "KA01AB1234")
        String plateNumber,

        @Schema(description = "Assigned driver ID", example = "drv-4f2a1b9c")
        String driverId,

        @Schema(description = "Assigned driver name", example = "Rajesh Sharma")
        String driverName,

        @Schema(description = "Safety event type", example = "FORWARD_COLLISION_WARNING",
                allowableValues = {"EMERGENCY_SOS", "OVERSPEED", "FATIGUE_DRIVING", "COLLISION", "ROLLOVER",
                        "PHONE_CALL", "SMOKING", "DISTRACTED_DRIVING", "FORWARD_COLLISION_WARNING", "LANE_DEPARTURE",
                        "RAPID_ACCELERATION", "HARSH_BRAKING", "SHARP_TURN"})
        String type,

        @Schema(description = "Severity level", example = "CRITICAL", allowableValues = {"CRITICAL", "MAJOR", "MINOR"})
        String severity,

        @Schema(description = "Event timestamp in UTC ISO 8601", example = "2026-11-02T10:15:30Z")
        Instant timestamp,

        @Schema(description = "Camera channel (1=Road, 2=Cabin)", example = "1")
        Integer channel,

        @Schema(description = "Event latitude", example = "33.7490")
        Double lat,

        @Schema(description = "Event longitude", example = "-84.3880")
        Double lng,

        @Schema(description = "Speed at event time in km/h", example = "72.4")
        Double speed,

        @Schema(description = "Odometer reading at event time with source")
        OdometerDto odometer,

        @Schema(description = "Human-readable description", example = "Forward collision warning (ADAS) (CH1)")
        String description,

        @Schema(description = "Triage coaching status", example = "NEEDS_REVIEW",
                allowableValues = {"NEEDS_REVIEW", "COACHED", "RECOGNIZED", "DISMISSED"})
        String triageStatus,

        @Schema(description = "Coaching category", example = "SAFE_FOLLOWING_DISTANCE")
        String coachingCategory,

        @Schema(description = "Manager review notes", example = "Coached driver on 4-second following distance rule")
        String notes,

        @Schema(description = "Manager email who reviewed the event", example = "safety-manager@inurumfleet.com")
        String reviewedBy,

        @Schema(description = "Media availability state", example = "STORED_ON_SD",
                allowableValues = {"STORED_ON_SD", "READY", "PENDING_RETRIEVAL", "NOT_AVAILABLE"})
        String mediaStatus,

        @Schema(description = "Playback / download URL for event video (if retrieved)", example = "http://127.0.0.1:3000/media/live/018800123456_1/live.m3u8")
        String videoUrl,

        @Schema(description = "Road-facing camera stream URL", example = "http://127.0.0.1:3000/media/live/018800123456_1/live.m3u8")
        String roadChannelUrl,

        @Schema(description = "Cabin-facing camera stream URL", example = "http://127.0.0.1:3000/media/live/018800123456_2/live.m3u8")
        String cabinChannelUrl,

        @Schema(description = "Video link expiration timestamp in UTC ISO 8601", example = "2026-11-02T14:15:30Z")
        Instant mediaExpiresAt
) {
}

