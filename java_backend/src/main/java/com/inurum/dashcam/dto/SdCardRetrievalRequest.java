package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Request body to initiate video retrieval from DashCam SD card (JT/T 1078 0x9201 / 0x9206)")
public record SdCardRetrievalRequest(
        @NotBlank(message = "terminalId is required")
        @Schema(description = "Numeric JT/T 808 DashCam terminal ID", example = "018800123456", requiredMode = Schema.RequiredMode.REQUIRED)
        String terminalId,

        @Schema(description = "Camera channel to retrieve: 1=Road, 2=Cabin", example = "1", defaultValue = "1")
        Integer channel,

        @NotBlank(message = "startTime is required")
        @Schema(description = "Start time of clip to retrieve", example = "2026-11-02T08:00:00Z", requiredMode = Schema.RequiredMode.REQUIRED)
        String startTime,

        @NotBlank(message = "endTime is required")
        @Schema(description = "End time of clip to retrieve", example = "2026-11-02T08:05:00Z", requiredMode = Schema.RequiredMode.REQUIRED)
        String endTime,

        @Schema(description = "Optional safety event ID to link this retrieved video with", example = "evt-20261102-001")
        String safetyEventId
) {
}

