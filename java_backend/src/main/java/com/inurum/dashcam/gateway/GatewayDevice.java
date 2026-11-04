package com.inurum.dashcam.gateway;

import java.time.Instant;

/**
 * One terminal as the gateway's /api/devices reports it. online = the camera has a JT808 socket open
 * right now. lat/lng are null when the camera has no GNSS fix (it reports 0,0 then).
 */
public record GatewayDevice(
        String terminalId,
        boolean online,
        Instant lastOnline,
        Double lat,
        Double lng,
        double speed,
        String deviceType,
        String firmware,
        String simNo,
        String vehicleNo) {

    public boolean hasGpsFix() {
        return lat != null && lng != null;
    }
}
