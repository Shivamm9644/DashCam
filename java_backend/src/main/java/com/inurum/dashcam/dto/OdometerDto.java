package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Vehicle odometer reading with verified data provenance")
public record OdometerDto(
        @Schema(description = "Odometer reading value in kilometers", example = "142850.5")
        Double value,

        @Schema(description = "Unit of distance", example = "km")
        String unit,

        @Schema(description = "Provenance source: 'ECU' for OBD-II/CAN-bus or 'GPS_ESTIMATED' for accumulated GPS distance",
                example = "ECU", allowableValues = {"ECU", "GPS_ESTIMATED"})
        String source
) {
    public static OdometerDto of(Double value, String source) {
        return new OdometerDto(value != null ? value : 0.0, "km", source != null ? source : "GPS_ESTIMATED");
    }
}

