package com.inurum.dashcam;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.inurum.dashcam.dto.OdometerDto;
import com.inurum.dashcam.dto.truckercloud.TruckerCloudTelemetryDto;
import com.inurum.dashcam.dto.truckercloud.TruckerCloudVehicleDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

public class TruckerCloudContractTest {

    private final ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Test
    @DisplayName("TruckerCloudVehicleDto serializes with all required fields")
    void testVehicleContract() throws Exception {
        TruckerCloudVehicleDto dto = new TruckerCloudVehicleDto(
                "veh-001",
                "1HD1KAE12FB012345",
                "KA01AB1234",
                "867543051234567",
                "018800123456",
                "Kenworth",
                "T680",
                2023,
                "tenant-inurum",
                "Inurum Logistics",
                "drv-01",
                "Rajesh Sharma",
                "DL-987654321",
                "ONLINE",
                OdometerDto.of(142850.5, "ECU"),
                Instant.parse("2026-11-02T10:00:00Z")
        );

        String json = mapper.writeValueAsString(dto);
        assertTrue(json.contains("\"vin\":\"1HD1KAE12FB012345\""));
        assertTrue(json.contains("\"licensePlate\":\"KA01AB1234\""));
        assertTrue(json.contains("\"source\":\"ECU\""));
        assertTrue(json.contains("\"unit\":\"km\""));
        assertTrue(json.contains("2026-11-02T10:00:00Z"));
    }

    @Test
    @DisplayName("TruckerCloudTelemetryDto serializes with valid UTC ISO timestamp and metric units")
    void testTelemetryContract() throws Exception {
        TruckerCloudTelemetryDto telemetry = new TruckerCloudTelemetryDto(
                "veh-001",
                "1HD1KAE12FB012345",
                "KA01AB1234",
                "867543051234567",
                "018800123456",
                Instant.parse("2026-11-02T12:00:00Z"),
                33.7490,
                -84.3880,
                65.4,
                180.0,
                315.0,
                true,
                OdometerDto.of(142850.5, "ECU")
        );

        String json = mapper.writeValueAsString(telemetry);
        assertTrue(json.contains("\"latitude\":33.749"));
        assertTrue(json.contains("\"longitude\":-84.388"));
        assertTrue(json.contains("\"speedKmH\":65.4"));
        assertTrue(json.contains("2026-11-02T12:00:00Z"));
    }
}
