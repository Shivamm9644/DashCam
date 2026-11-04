package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Request body to update driver details")
public record UpdateDriverRequest(
        @Schema(description = "Driver full name", example = "Rajesh Sharma")
        String name,

        @Schema(description = "Phone number", example = "+1-555-0199")
        String phone,

        @Schema(description = "Email address", example = "rajesh.sharma@inurumfleet.com")
        String email,

        @Schema(description = "Driver's license number", example = "DL-987654321")
        String licenseNumber,

        @Schema(description = "Issuing state", example = "GA")
        String licenseState,

        @Schema(description = "Duty status", example = "ON_DUTY", allowableValues = {"ACTIVE", "INACTIVE", "ON_DUTY", "OFF_DUTY"})
        String status,

        @Schema(description = "Assigned vehicle ID (empty string to unassign)", example = "veh-8a7b9c1d")
        String assignedVehicleId
) {
}

