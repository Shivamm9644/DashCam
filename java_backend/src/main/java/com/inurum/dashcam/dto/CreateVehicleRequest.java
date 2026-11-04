package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Schema(description = "Request body to create a new fleet vehicle")
public record CreateVehicleRequest(
        @NotBlank(message = "plateNumber is required")
        @Schema(description = "Vehicle registration license plate", example = "KA01AB1234", requiredMode = Schema.RequiredMode.REQUIRED)
        String plateNumber,

        @Pattern(regexp = "^[A-HJ-NPR-Z0-9]{17}$", message = "VIN must be a valid 17-character alphanumeric string (excluding I, O, Q)")
        @Schema(description = "17-character VIN", example = "1HD1KAE12FB012345")
        String vin,

        @Schema(description = "DashCam 15-digit IMEI", example = "867543051234567")
        String imei,

        @Schema(description = "Display label", example = "Truck 101 - Kenworth T680")
        String label,

        @Schema(description = "Make and model", example = "Kenworth T680")
        String model,

        @Schema(description = "Manufacture year", example = "2023")
        Integer year,

        @Schema(description = "Assigned driver ID", example = "drv-4f2a1b9c")
        String driverId,

        @Schema(description = "Assigned driver name", example = "Rajesh Sharma")
        String driverName,

        @Schema(description = "Assigned driver phone", example = "+1-555-0199")
        String driverPhone,

        @Schema(description = "Assigned driver license", example = "DL-987654321")
        String driverLicense,

        @Schema(description = "Initial odometer in km", example = "142800.0")
        Double odometerKm,

        @Schema(description = "Odometer provenance: 'ECU' or 'GPS_ESTIMATED'", example = "ECU")
        String odometerSource,

        @Schema(description = "DashCam numeric JT808 terminal ID to pair immediately", example = "018800123456")
        String terminalId
) {
}

