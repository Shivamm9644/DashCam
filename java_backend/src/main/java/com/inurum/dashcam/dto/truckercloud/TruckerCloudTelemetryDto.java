package com.inurum.dashcam.dto.truckercloud;

import com.inurum.dashcam.dto.OdometerDto;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "TruckerCloud high-frequency live/historical GPS telematics record")
public record TruckerCloudTelemetryDto(
        @Schema(description = "Vehicle ID", example = "veh-8a7b9c1d")
        String vehicleId,

        @Schema(description = "17-character VIN", example = "1HD1KAE12FB012345")
        String vin,

        @Schema(description = "Vehicle license plate", example = "KA01AB1234")
        String licensePlate,

        @Schema(description = "DashCam IMEI number", example = "867543051234567")
        String imei,

        @Schema(description = "Terminal ID", example = "018800123456")
        String terminalId,

        @Schema(description = "Timestamp in UTC ISO 8601", example = "2026-11-02T11:45:00Z")
        Instant timestamp,

        @Schema(description = "WGS-84 latitude", example = "33.749000")
        double latitude,

        @Schema(description = "WGS-84 longitude", example = "-84.388000")
        double longitude,

        @Schema(description = "Speed in km/h", example = "65.4")
        double speedKmH,

        @Schema(description = "Heading in degrees from true North (0-359)", example = "180.0")
        double heading,

        @Schema(description = "Altitude in meters above sea level", example = "315.0")
        Double altitudeMeters,

        @Schema(description = "Ignition state (true = ACC ON)", example = "true")
        Boolean ignition,

        @Schema(description = "Odometer reading with clearly identified provenance source")
        OdometerDto odometer
) {
}

