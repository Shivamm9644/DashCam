package com.inurum.dashcam.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * On-demand SD card video retrieval job state machine.
 * Lifecycle: QUEUED -> WAITING_FOR_DEVICE -> TRANSFERRING -> PROCESSING -> READY / FAILED
 */
@Entity
@Table(name = "video_retrieval_jobs", indexes = {
        @Index(name = "idx_vjob_terminal", columnList = "terminalId"),
        @Index(name = "idx_vjob_status", columnList = "status"),
        @Index(name = "idx_vjob_tenant", columnList = "tenantId")
})
public class VideoRetrievalJobEntity {

    @Id
    @Column(length = 64)
    public String id;

    @Column(nullable = false, length = 64)
    public String tenantId;

    @Column(nullable = false, length = 32)
    public String terminalId;

    @Column(length = 64)
    public String vehicleId;

    /** 1 = Road Camera (CH1), 2 = Cabin DMS Camera (CH2), 0 = Dual Channel */
    @Column(nullable = false)
    public int channel;

    @Column(nullable = false, length = 32)
    public String startTime;

    @Column(nullable = false, length = 32)
    public String endTime;

    /** QUEUED, WAITING_FOR_DEVICE, TRANSFERRING, PROCESSING, READY, FAILED */
    @Column(nullable = false, length = 32)
    public String status;

    public int progress; // 0 - 100

    @Column(length = 512)
    public String videoUrl;

    @Column(length = 512)
    public String roadChannelUrl;

    @Column(length = 512)
    public String cabinChannelUrl;

    @Column(length = 512)
    public String errorMessage;

    @Column(length = 64)
    public String safetyEventId;

    @Column(nullable = false)
    public Instant createdAt;

    public Instant updatedAt;

    public Instant expiresAt;
}

