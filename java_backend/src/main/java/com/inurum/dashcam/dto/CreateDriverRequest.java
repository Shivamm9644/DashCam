package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Request body to register a driver")
public record CreateDriverRequest(
        @NotBlank(message = "name is required")
        @Schema(description = "Driver full name", example = "Rajesh Sharma", requiredMode = Schema.RequiredMode.REQUIRED)
        String name,

        @Schema(description = "Phone number", example = "+1-555-0199")
        String phone,

        @Schema(description = "Email address", example = "rajesh.sharma@inurumfleet.com")
        String email,

        @Schema(description = "Driver's license number", example = "DL-987654321")
        String licenseNumber,

        @Schema(description = "Issuing state", example = "GA")
        String licenseState,

        @Schema(description = "Assigned vehicle ID", example = "veh-8a7b9c1d")
        String assignedVehicleId
) {
}

