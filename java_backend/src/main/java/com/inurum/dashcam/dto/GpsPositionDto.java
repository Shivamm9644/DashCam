package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "GPS position telemetry fix")
public record GpsPositionDto(
        @Schema(description = "DashCam terminal ID", example = "018800123456")
        String terminalId,

        @Schema(description = "Vehicle ID", example = "veh-8a7b9c1d")
        String vehicleId,

        @Schema(description = "Vehicle license plate", example = "KA01AB1234")
        String plateNumber,

        @Schema(description = "17-character VIN", example = "1HD1KAE12FB012345")
        String vin,

        @Schema(description = "Latitude in WGS-84 decimal degrees", example = "33.749000")
        double lat,

        @Schema(description = "Longitude in WGS-84 decimal degrees", example = "-84.388000")
        double lng,

        @Schema(description = "Speed in km/h", example = "65.2")
        double speed,

        @Schema(description = "Heading in degrees clockwise from true North (0-359)", example = "180.0")
        double heading,

        @Schema(description = "Altitude in meters above sea level", example = "320.0")
        Double altitude,

        @Schema(description = "Odometer reading with source")
        OdometerDto odometer,

        @Schema(description = "Vehicle ignition state (ACC)", example = "true")
        Boolean ignition,

        @Schema(description = "Device timestamp in UTC ISO 8601", example = "2026-11-02T11:45:00Z")
        Instant timestamp
) {
}

