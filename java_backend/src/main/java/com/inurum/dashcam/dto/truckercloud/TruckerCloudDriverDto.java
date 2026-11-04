package com.inurum.dashcam.dto.truckercloud;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "TruckerCloud driver entity with vehicle assignment")
public record TruckerCloudDriverDto(
        @Schema(description = "Unique driver ID", example = "drv-4f2a1b9c")
        String id,

        @Schema(description = "Full name", example = "Rajesh Sharma")
        String name,

        @Schema(description = "Commercial driver license number", example = "DL-987654321")
        String licenseNumber,

        @Schema(description = "License issuing state/jurisdiction", example = "GA")
        String licenseState,

        @Schema(description = "Phone number", example = "+1-555-0199")
        String phone,

        @Schema(description = "Email address", example = "rajesh.sharma@inurumfleet.com")
        String email,

        @Schema(description = "Duty status", example = "ON_DUTY", allowableValues = {"ACTIVE", "INACTIVE", "ON_DUTY", "OFF_DUTY"})
        String status,

        @Schema(description = "Assigned vehicle ID", example = "veh-8a7b9c1d")
        String assignedVehicleId,

        @Schema(description = "Assigned vehicle 17-char VIN", example = "1HD1KAE12FB012345")
        String assignedVin,

        @Schema(description = "Assigned vehicle license plate", example = "KA01AB1234")
        String assignedPlateNumber,

        @Schema(description = "Fleet ID", example = "tenant-inurum")
        String fleetId,

        @Schema(description = "Created timestamp (UTC ISO 8601)", example = "2026-10-15T08:00:00Z")
        Instant createdAt
) {
}

