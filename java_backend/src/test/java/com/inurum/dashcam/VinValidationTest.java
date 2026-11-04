package com.inurum.dashcam;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

public class VinValidationTest {

    private static final Pattern VIN_PATTERN = Pattern.compile("^[A-HJ-NPR-Z0-9]{17}$");

    @Test
    @DisplayName("Valid 17-character VINs are accepted")
    void validVinsPass() {
        assertTrue(VIN_PATTERN.matcher("1HD1KAE12FB012345").matches());
        assertTrue(VIN_PATTERN.matcher("1M8GDM9A_KP042788".replace('_', '0')).matches());
        assertTrue(VIN_PATTERN.matcher("2T1BR32E83C123456").matches());
    }

    @Test
    @DisplayName("Invalid VIN lengths or illegal characters (I, O, Q) are rejected")
    void invalidVinsFail() {
        assertFalse(VIN_PATTERN.matcher("SHORTVIN123").matches());
        assertFalse(VIN_PATTERN.matcher("1HD1KAE12FB012345EXTRA").matches());
        assertFalse(VIN_PATTERN.matcher("1HD1KAE12IB012345").matches(), "Letter 'I' is not allowed in standard VIN");
        assertFalse(VIN_PATTERN.matcher("1HD1KAE12OB012345").matches(), "Letter 'O' is not allowed in standard VIN");
        assertFalse(VIN_PATTERN.matcher("1HD1KAE12QB012345").matches(), "Letter 'Q' is not allowed in standard VIN");
    }
}

