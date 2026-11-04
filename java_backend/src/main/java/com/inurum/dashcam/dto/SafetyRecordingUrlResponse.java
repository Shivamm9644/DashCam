package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Documented response for safety event video retrieval")
public record SafetyRecordingUrlResponse(
        @Schema(description = "Safety event ID", example = "evt-20261102-001")
        String eventId,

        @Schema(description = "DashCam terminal ID", example = "018800123456")
        String terminalId,

        @Schema(description = "Associated vehicle ID", example = "veh-8a7b9c1d")
        String vehicleId,

        @Schema(description = "17-character VIN", example = "1HD1KAE12FB012345")
        String vin,

        @Schema(description = "Media availability state", example = "READY",
                allowableValues = {"STORED_ON_SD", "READY", "PENDING_RETRIEVAL", "NOT_AVAILABLE"})
        String mediaStatus,

        @Schema(description = "Playback / HLS video URL for the event", example = "http://127.0.0.1:3000/media/live/018800123456_1/live.m3u8")
        String videoUrl,

        @Schema(description = "Road-facing camera URL (CH1)", example = "http://127.0.0.1:3000/media/live/018800123456_1/live.m3u8")
        String roadUrl,

        @Schema(description = "Cabin DMS camera URL (CH2)", example = "http://127.0.0.1:3000/media/live/018800123456_2/live.m3u8")
        String cabinUrl,

        @Schema(description = "Stream format", example = "HLS")
        String format,

        @Schema(description = "URL expiration timestamp (UTC ISO 8601)", example = "2026-11-02T16:00:00Z")
        Instant expiresAt,

        @Schema(description = "Instruction message", example = "Video clip is ready for streaming from the dashcam gateway.")
        String message
) {
}

