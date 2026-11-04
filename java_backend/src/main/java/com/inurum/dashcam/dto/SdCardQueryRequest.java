package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Request body to query recorded video files on the physical DashCam SD card (JT/T 1078 0x9205)")
public record SdCardQueryRequest(
        @NotBlank(message = "terminalId is required")
        @Schema(description = "Numeric JT/T 808 DashCam terminal ID", example = "018800123456", requiredMode = Schema.RequiredMode.REQUIRED)
        String terminalId,

        @Schema(description = "Camera channel: 1=Road, 2=Cabin, 0=All Channels", example = "0", defaultValue = "0")
        Integer channel,

        @NotBlank(message = "startTime is required")
        @Schema(description = "Query window start time (UTC ISO 8601 or YYYY-MM-DD HH:mm:ss)", example = "2026-11-02T08:00:00Z", requiredMode = Schema.RequiredMode.REQUIRED)
        String startTime,

        @NotBlank(message = "endTime is required")
        @Schema(description = "Query window end time (UTC ISO 8601 or YYYY-MM-DD HH:mm:ss)", example = "2026-11-02T12:00:00Z", requiredMode = Schema.RequiredMode.REQUIRED)
        String endTime
) {
}

