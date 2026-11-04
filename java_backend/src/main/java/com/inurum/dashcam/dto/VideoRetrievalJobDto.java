package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Video retrieval job state machine status")
public record VideoRetrievalJobDto(
        @Schema(description = "Job unique identifier", example = "sd-018800123456-1730548800000")
        String id,

        @Schema(description = "Tenant ID", example = "tenant-inurum")
        String tenantId,

        @Schema(description = "Terminal ID", example = "018800123456")
        String terminalId,

        @Schema(description = "Associated vehicle ID", example = "veh-8a7b9c1d")
        String vehicleId,

        @Schema(description = "Camera channel (1=Road, 2=Cabin)", example = "1")
        int channel,

        @Schema(description = "Start time of retrieved video", example = "2026-11-02T08:00:00")
        String startTime,

        @Schema(description = "End time of retrieved video", example = "2026-11-02T08:05:00")
        String endTime,

        @Schema(description = "Job lifecycle state", example = "READY",
                allowableValues = {"QUEUED", "WAITING_FOR_DEVICE", "TRANSFERRING", "PROCESSING", "READY", "FAILED"})
        String status,

        @Schema(description = "Transfer / processing progress (0-100)", example = "100")
        int progress,

        @Schema(description = "Playable HLS / MP4 stream URL", example = "http://127.0.0.1:3000/media/live/018800123456_1/live.m3u8")
        String videoUrl,

        @Schema(description = "Road-facing camera stream URL (CH1)", example = "http://127.0.0.1:3000/media/live/018800123456_1/live.m3u8")
        String roadChannelUrl,

        @Schema(description = "Cabin-facing camera stream URL (CH2)", example = "http://127.0.0.1:3000/media/live/018800123456_2/live.m3u8")
        String cabinChannelUrl,

        @Schema(description = "Error message if failed", example = "null")
        String errorMessage,

        @Schema(description = "Associated safety event ID", example = "evt-20261102-001")
        String safetyEventId,

        @Schema(description = "Job creation timestamp", example = "2026-11-02T11:45:00Z")
        Instant createdAt,

        @Schema(description = "Job last updated timestamp", example = "2026-11-02T11:45:30Z")
        Instant updatedAt,

        @Schema(description = "Video stream link expiration timestamp", example = "2026-11-02T15:45:00Z")
        Instant expiresAt,

        @Schema(description = "Status description message", example = "Playing from the dashcam SD card.")
        String message
) {
}

