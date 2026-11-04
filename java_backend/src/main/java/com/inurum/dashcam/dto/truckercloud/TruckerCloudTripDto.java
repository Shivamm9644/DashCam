package com.inurum.dashcam.dto.truckercloud;

import com.inurum.dashcam.dto.OdometerDto;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "TruckerCloud completed or ongoing trip record")
public record TruckerCloudTripDto(
        @Schema(description = "Trip ID", example = "trip-20261102-1")
        String tripId,

        @Schema(description = "Vehicle ID", example = "veh-8a7b9c1d")
        String vehicleId,

        @Schema(description = "17-character VIN", example = "1HD1KAE12FB012345")
        String vin,

        @Schema(description = "Vehicle license plate", example = "KA01AB1234")
        String licensePlate,

        @Schema(description = "Driver ID", example = "drv-4f2a1b9c")
        String driverId,

        @Schema(description = "Driver name", example = "Rajesh Sharma")
        String driverName,

        @Schema(description = "Trip start time (UTC ISO 8601)", example = "2026-11-02T08:00:00Z")
        Instant startTime,

        @Schema(description = "Trip end time (UTC ISO 8601)", example = "2026-11-02T10:30:00Z")
        Instant endTime,

        @Schema(description = "Start location", example = "Atlanta Depot, GA")
        String startLocation,

        @Schema(description = "End location", example = "Macon Hub, GA")
        String endLocation,

        @Schema(description = "Total distance driven in km", example = "136.5")
        Double distanceKm,

        @Schema(description = "Max speed in km/h", example = "104.2")
        Double maxSpeedKmH,

        @Schema(description = "Average speed in km/h", example = "54.6")
        Double avgSpeedKmH,

        @Schema(description = "Starting odometer reading")
        OdometerDto startOdometer,

        @Schema(description = "Ending odometer reading")
        OdometerDto endOdometer,

        @Schema(description = "Count of GPS breadcrumb points in this trip", example = "420")
        int breadcrumbsCount
) {
}

