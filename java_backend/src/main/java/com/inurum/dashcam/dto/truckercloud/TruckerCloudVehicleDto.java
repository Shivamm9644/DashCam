package com.inurum.dashcam.dto.truckercloud;

import com.inurum.dashcam.dto.OdometerDto;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "TruckerCloud standard vehicle representation with validated 17-char VIN and ECU/GPS odometer")
public record TruckerCloudVehicleDto(
        @Schema(description = "Inurum internal vehicle ID", example = "veh-8a7b9c1d")
        String id,

        @Schema(description = "17-character standardized Vehicle Identification Number (VIN)", example = "1HD1KAE12FB012345")
        String vin,

        @Schema(description = "Vehicle registration license plate number", example = "KA01AB1234")
        String licensePlate,

        @Schema(description = "DashCam 15-digit IMEI number", example = "867543051234567")
        String imei,

        @Schema(description = "Numeric JT/T 808 terminal ID", example = "018800123456")
        String terminalId,

        @Schema(description = "Vehicle make", example = "Kenworth")
        String make,

        @Schema(description = "Vehicle model", example = "T680")
        String model,

        @Schema(description = "Model year", example = "2023")
        Integer year,

        @Schema(description = "Fleet / Tenant ID", example = "tenant-inurum")
        String fleetId,

        @Schema(description = "Fleet name", example = "Inurum Enterprise Logistics")
        String fleetName,

        @Schema(description = "Assigned driver ID", example = "drv-4f2a1b9c")
        String driverId,

        @Schema(description = "Assigned driver full name", example = "Rajesh Sharma")
        String driverName,

        @Schema(description = "Assigned driver commercial license number", example = "DL-987654321")
        String driverLicense,

        @Schema(description = "Operational connection status", example = "ONLINE", allowableValues = {"ONLINE", "OFFLINE", "DEACTIVATED"})
        String status,

        @Schema(description = "Odometer reading with provenance distinction ('ECU' vs 'GPS_ESTIMATED')")
        OdometerDto odometer,

        @Schema(description = "Last reported telematics timestamp (UTC ISO 8601)", example = "2026-11-02T11:45:00Z")
        Instant lastSeen
) {
}

