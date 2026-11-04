package com.inurum.dashcam.dto.truckercloud;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "TruckerCloud video proof URL details")
public record TruckerCloudRecordingUrlDto(
        @Schema(description = "Associated safety event ID", example = "evt-20261102-001")
        String eventId,

        @Schema(description = "Vehicle ID", example = "veh-8a7b9c1d")
        String vehicleId,

        @Schema(description = "17-character VIN", example = "1HD1KAE12FB012345")
        String vin,

        @Schema(description = "Media availability state", example = "READY",
                allowableValues = {"STORED_ON_SD", "READY", "PENDING_RETRIEVAL", "NOT_AVAILABLE"})
        String mediaStatus,

        @Schema(description = "Primary video playback URL", example = "http://127.0.0.1:3000/media/live/018800123456_1/live.m3u8")
        String videoUrl,

        @Schema(description = "Road-facing camera stream URL", example = "http://127.0.0.1:3000/media/live/018800123456_1/live.m3u8")
        String roadChannelUrl,

        @Schema(description = "Cabin-facing camera stream URL", example = "http://127.0.0.1:3000/media/live/018800123456_2/live.m3u8")
        String cabinChannelUrl,

        @Schema(description = "Video stream format", example = "HLS")
        String format,

        @Schema(description = "Stream link expiration timestamp (UTC ISO 8601)", example = "2026-11-02T16:00:00Z")
        Instant expiresAt,

        @Schema(description = "Status / instruction message", example = "Video clip ready for streaming.")
        String message
) {
}

