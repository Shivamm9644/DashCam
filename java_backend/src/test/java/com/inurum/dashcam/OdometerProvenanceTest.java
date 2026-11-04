package com.inurum.dashcam;

import com.inurum.dashcam.dto.OdometerDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class OdometerProvenanceTest {

    @Test
    @DisplayName("Odometer properly retains provenance source and unit")
    void testOdometerProvenance() {
        OdometerDto ecuOdo = OdometerDto.of(154200.5, "ECU");
        assertEquals("ECU", ecuOdo.source());
        assertEquals(154200.5, ecuOdo.value());
        assertEquals("km", ecuOdo.unit());

        OdometerDto gpsOdo = OdometerDto.of(450.2, "GPS_ESTIMATED");
        assertEquals("GPS_ESTIMATED", gpsOdo.source());
        assertEquals(450.2, gpsOdo.value());
        assertEquals("km", gpsOdo.unit());
    }

    @Test
    @DisplayName("Default provenance defaults to GPS_ESTIMATED if null")
    void testDefaultProvenance() {
        OdometerDto defaultOdo = OdometerDto.of(120.0, null);
        assertEquals("GPS_ESTIMATED", defaultOdo.source());
    }
}

