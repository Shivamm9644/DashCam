package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Schema(description = "Vehicle details including VIN, paired DashCam terminal, driver and live telematics")
public record VehicleDto(
        @Schema(description = "Unique vehicle identifier", example = "veh-8a7b9c1d")
        String id,

        @Schema(description = "Tenant / Fleet ID", example = "tenant-inurum")
        String tenantId,

        @Schema(description = "Tenant / Fleet Name", example = "Inurum Logistics")
        String tenantName,

        @Schema(description = "Vehicle registration plate number", example = "KA01AB1234")
        String plateNumber,

        @Schema(description = "17-character standardized Vehicle Identification Number (VIN)", example = "1HD1KAE12FB012345")
        String vin,

        @Schema(description = "DashCam 15-digit IMEI number", example = "867543051234567")
        String imei,

        @Schema(description = "Display label", example = "Truck 101 - Kenworth T680")
        String label,

        @Schema(description = "Vehicle model", example = "Kenworth T680")
        String model,

        @Schema(description = "Vehicle manufacture year", example = "2023")
        Integer year,

        @Schema(description = "Assigned driver ID", example = "drv-4f2a1b9c")
        String driverId,

        @Schema(description = "Assigned driver name", example = "Rajesh Sharma")
        String driverName,

        @Schema(description = "Assigned driver phone", example = "+1-555-0199")
        String driverPhone,

        @Schema(description = "Assigned driver commercial license number", example = "DL-987654321")
        String driverLicense,

        @Schema(description = "Paired JT808 terminal ID", example = "018800123456")
        String assignedDeviceId,

        @Schema(description = "Paired JT808 terminal ID (alias)", example = "018800123456")
        String terminalId,

        @Schema(description = "DashCam hardware model", example = "WanWay H20P")
        String dashcamModel,

        @Schema(description = "Vehicle operational status", example = "ONLINE", allowableValues = {"ONLINE", "OFFLINE", "DEACTIVATED"})
        String status,

        @Schema(description = "Current vehicle speed in km/h", example = "64.5")
        double speed,

        @Schema(description = "Current vehicle heading (0-359 degrees)", example = "182.0")
        double heading,

        @Schema(description = "Current GPS latitude", example = "33.7490")
        Double lat,

        @Schema(description = "Current GPS longitude", example = "-84.3880")
        Double lng,

        @Schema(description = "Whether device has valid GPS fix", example = "true")
        boolean hasGpsFix,

        @Schema(description = "Reverse geocoded address or status", example = "I-85 N, Atlanta, GA 30303")
        String address,

        @Schema(description = "Ignition status", example = "true")
        Boolean ignition,

        @Schema(description = "Vehicle odometer reading with provenance")
        OdometerDto odometer,

        @Schema(description = "Last communication timestamp (UTC ISO 8601)", example = "2026-11-02T11:45:00Z")
        Instant lastSeen,

        @Schema(description = "Camera channels available on this vehicle")
        List<Map<String, Object>> channels,

        @Schema(description = "Whether camera was auto-discovered", example = "false")
        boolean autoDiscovered,

        @Schema(description = "Record creation timestamp", example = "2026-10-15T08:00:00Z")
        Instant createdAt
) {
}

