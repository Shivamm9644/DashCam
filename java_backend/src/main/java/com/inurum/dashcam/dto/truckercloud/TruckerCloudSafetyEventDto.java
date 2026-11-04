package com.inurum.dashcam.dto.truckercloud;

import com.inurum.dashcam.dto.OdometerDto;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "TruckerCloud safety event record with vehicle, driver and video evidence")
public record TruckerCloudSafetyEventDto(
        @Schema(description = "Unique event ID", example = "evt-20261102-001")
        String eventId,

        @Schema(description = "Vehicle ID", example = "veh-8a7b9c1d")
        String vehicleId,

        @Schema(description = "17-character VIN", example = "1HD1KAE12FB012345")
        String vin,

        @Schema(description = "Vehicle license plate", example = "KA01AB1234")
        String licensePlate,

        @Schema(description = "DashCam IMEI", example = "867543051234567")
        String imei,

        @Schema(description = "Assigned driver ID", example = "drv-4f2a1b9c")
        String driverId,

        @Schema(description = "Assigned driver name", example = "Rajesh Sharma")
        String driverName,

        @Schema(description = "Standardized event type", example = "FORWARD_COLLISION_WARNING")
        String eventType,

        @Schema(description = "Severity", example = "CRITICAL", allowableValues = {"CRITICAL", "MAJOR", "MINOR"})
        String severity,

        @Schema(description = "Timestamp in UTC ISO 8601", example = "2026-11-02T10:15:30Z")
        Instant timestamp,

        @Schema(description = "Camera channel involved", example = "1")
        Integer channel,

        @Schema(description = "Event latitude", example = "33.7490")
        Double latitude,

        @Schema(description = "Event longitude", example = "-84.3880")
        Double longitude,

        @Schema(description = "Speed at time of event in km/h", example = "72.4")
        Double speedKmH,

        @Schema(description = "Odometer at time of event with source")
        OdometerDto odometer,

        @Schema(description = "Media availability state", example = "READY",
                allowableValues = {"STORED_ON_SD", "READY", "PENDING_RETRIEVAL", "NOT_AVAILABLE"})
        String mediaStatus,

        @Schema(description = "Road-facing camera clip URL", example = "http://127.0.0.1:3000/media/live/018800123456_1/live.m3u8")
        String roadVideoUrl,

        @Schema(description = "Cabin-facing camera clip URL", example = "http://127.0.0.1:3000/media/live/018800123456_2/live.m3u8")
        String cabinVideoUrl,

        @Schema(description = "Media URL expiration timestamp (UTC ISO 8601)", example = "2026-11-02T16:00:00Z")
        Instant mediaExpiresAt
) {
}

