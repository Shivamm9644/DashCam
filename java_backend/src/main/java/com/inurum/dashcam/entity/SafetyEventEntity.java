package com.inurum.dashcam.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * An alarm or safety incident reported by a DashCam (ADAS, DMS, G-Sensor, SOS).
 * Footage stays on the camera's MicroSD card by default, and can be retrieved on demand.
 */
@Entity
@Table(name = "safety_events", indexes = {
        @Index(name = "idx_sevents_terminal", columnList = "terminalId"),
        @Index(name = "idx_sevents_tenant", columnList = "tenantId"),
        @Index(name = "idx_sevents_time", columnList = "timestamp DESC"),
        @Index(name = "idx_sevents_type", columnList = "type")
})
public class SafetyEventEntity {

    @Id
    @Column(length = 64)
    public String id;

    @Column(nullable = false, length = 64)
    public String tenantId;

    @Column(nullable = false, length = 32)
    public String terminalId;

    @Column(length = 64)
    public String vehicleId;

    @Column(length = 17)
    public String vin;

    @Column(length = 64)
    public String driverId;

    @Column(length = 120)
    public String driverName;

    @Column(nullable = false, length = 48)
    public String type;

    /** CRITICAL, MAJOR or MINOR */
    @Column(length = 16)
    public String severity;

    @Column(nullable = false)
    public Instant timestamp;

    public Integer channel;
    public Double lat;
    public Double lng;
    public Double speed;

    /** Vehicle odometer at the time of the event in km */
    public Double odometerKm;

    /** ECU or GPS_ESTIMATED */
    @Column(length = 20)
    public String odometerSource = "GPS_ESTIMATED";

    @Column(length = 255)
    public String description;

    /** NEEDS_REVIEW, COACHED, RECOGNIZED or DISMISSED */
    @Column(nullable = false, length = 16)
    public String triageStatus;

    @Column(length = 48)
    public String coachingCategory;

    @Column(length = 1000)
    public String reviewNotes;

    @Column(length = 160)
    public String reviewedBy;

    public Instant reviewedAt;

    /** Media status: STORED_ON_SD, RETRIEVED, PENDING_RETRIEVAL, NOT_AVAILABLE */
    @Column(length = 32)
    public String mediaStatus = "STORED_ON_SD";

    @Column(length = 512)
    public String videoUrl;

    @Column(length = 512)
    public String roadChannelUrl;

    @Column(length = 512)
    public String cabinChannelUrl;

    public Instant mediaExpiresAt;
}
