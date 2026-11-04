package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Driver profile and vehicle assignment details")
public record DriverDto(
        @Schema(description = "Unique driver identifier", example = "drv-4f2a1b9c")
        String id,

        @Schema(description = "Tenant ID", example = "tenant-inurum")
        String tenantId,

        @Schema(description = "Full legal name", example = "Rajesh Sharma")
        String name,

        @Schema(description = "Phone number", example = "+1-555-0199")
        String phone,

        @Schema(description = "Email address", example = "rajesh.sharma@inurumfleet.com")
        String email,

        @Schema(description = "Commercial driver's license (CDL) number", example = "DL-987654321")
        String licenseNumber,

        @Schema(description = "Issuing state or territory", example = "GA")
        String licenseState,

        @Schema(description = "Driver duty status", example = "ON_DUTY", allowableValues = {"ACTIVE", "INACTIVE", "ON_DUTY", "OFF_DUTY"})
        String status,

        @Schema(description = "Assigned vehicle ID", example = "veh-8a7b9c1d")
        String assignedVehicleId,

        @Schema(description = "Assigned vehicle plate number", example = "KA01AB1234")
        String assignedVehiclePlate,

        @Schema(description = "Whether driver is active", example = "true")
        boolean active,

        @Schema(description = "Record creation timestamp", example = "2026-10-15T08:00:00Z")
        Instant createdAt,

        @Schema(description = "Record update timestamp", example = "2026-11-01T14:30:00Z")
        Instant updatedAt
) {
}

