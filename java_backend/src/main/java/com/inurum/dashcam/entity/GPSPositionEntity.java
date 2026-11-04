package com.inurum.dashcam.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Historical GPS breadcrumb records received from DashCam devices via JT/T 808 0x0200.
 */
@Entity
@Table(name = "gps_positions", indexes = {
        @Index(name = "idx_gps_terminal_time", columnList = "terminalId, timestamp DESC"),
        @Index(name = "idx_gps_vehicle_time", columnList = "vehicleId, timestamp DESC"),
        @Index(name = "idx_gps_time", columnList = "timestamp DESC")
})
public class GPSPositionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false, length = 32)
    public String terminalId;

    @Column(length = 64)
    public String vehicleId;

    @Column(length = 64)
    public String tenantId;

    /** Timestamp of the GPS fix from the satellite/device clock (UTC) */
    @Column(nullable = false)
    public Instant timestamp;

    @Column(nullable = false)
    public double lat;

    @Column(nullable = false)
    public double lng;

    public double speed; // km/h
    public double heading; // 0-359 degrees
    public double altitude; // meters

    public Double odometerKm;

    /** ECU or GPS_ESTIMATED */
    @Column(length = 20)
    public String odometerSource = "GPS_ESTIMATED";

    public Boolean ignition;
    public Long alarmFlags;
    public boolean validFix = true;

    @Column(nullable = false)
    public Instant recordedAt;
}

