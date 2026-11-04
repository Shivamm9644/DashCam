package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Response containing recordings found on DashCam SD card")
public record SdCardQueryResponse(
        @Schema(description = "DashCam terminal ID", example = "018800123456")
        String terminalId,

        @Schema(description = "Count of matching video files found on device", example = "8")
        int availableResources,

        @Schema(description = "List of recording files discovered on SD card")
        List<SdCardFileDto> resources
) {
}

