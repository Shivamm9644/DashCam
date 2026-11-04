package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Video recording file metadata stored on DashCam SD card")
public record SdCardFileDto(
        @Schema(description = "Generated file identifier", example = "018800123456_1_20261102080000")
        String id,

        @Schema(description = "Terminal ID", example = "018800123456")
        String terminalId,

        @Schema(description = "Camera channel (1=Road, 2=Cabin)", example = "1")
        int channel,

        @Schema(description = "Start time of recording chunk", example = "2026-11-02T08:00:00")
        String startTime,

        @Schema(description = "End time of recording chunk", example = "2026-11-02T08:05:00")
        String endTime,

        @Schema(description = "Duration in MM:SS format", example = "05:00")
        String duration,

        @Schema(description = "File size in bytes", example = "35651584")
        long fileSizeBytes,

        @Schema(description = "Storage medium", example = "SD_CARD")
        String storageSource
) {
}

