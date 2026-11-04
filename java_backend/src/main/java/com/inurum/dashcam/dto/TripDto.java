package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

@Schema(description = "Trip recording with summary statistics and GPS breadcrumbs")
public record TripDto(
        @Schema(description = "Unique trip ID", example = "trip-20261102-1")
        String id,

        @Schema(description = "Tenant ID", example = "tenant-inurum")
        String tenantId,

        @Schema(description = "DashCam terminal ID", example = "018800123456")
        String terminalId,

        @Schema(description = "Vehicle ID", example = "veh-8a7b9c1d")
        String vehicleId,

        @Schema(description = "17-character VIN", example = "1HD1KAE12FB012345")
        String vin,

        @Schema(description = "Vehicle license plate", example = "KA01AB1234")
        String plateNumber,

        @Schema(description = "Assigned driver ID", example = "drv-4f2a1b9c")
        String driverId,

        @Schema(description = "Assigned driver name", example = "Rajesh Sharma")
        String driverName,

        @Schema(description = "Trip start time (UTC ISO 8601)", example = "2026-11-02T08:00:00Z")
        Instant startTime,

        @Schema(description = "Trip end time (UTC ISO 8601)", example = "2026-11-02T10:30:00Z")
        Instant endTime,

        @Schema(description = "Start location description or coordinates", example = "Atlanta Depot, GA")
        String startLocation,

        @Schema(description = "End location description or coordinates", example = "Macon Hub, GA")
        String endLocation,

        @Schema(description = "Total distance driven in km", example = "136.5")
        Double distanceKm,

        @Schema(description = "Maximum recorded speed in km/h", example = "104.2")
        Double maxSpeedKmH,

        @Schema(description = "Average speed during trip in km/h", example = "54.6")
        Double avgSpeedKmH,

        @Schema(description = "Odometer reading at trip start")
        OdometerDto startOdometer,

        @Schema(description = "Odometer reading at trip end")
        OdometerDto endOdometer,

        @Schema(description = "GPS breadcrumb points along trip route")
        List<Object> points
) {
}

