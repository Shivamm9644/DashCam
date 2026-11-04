package com.inurum.dashcam.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * One live view of a camera. Summed per month for the live-minutes quota.
 */
@Entity
@Table(name = "live_sessions")
public class LiveSessionEntity {

    @Id
    @Column(length = 96)
    public String id;

    @Column(nullable = false, length = 64)
    public String tenantId;

    @Column(nullable = false, length = 64)
    public String userId;

    @Column(nullable = false, length = 32)
    public String terminalId;

    @Column(nullable = false)
    public int channel;

    @Column(nullable = false)
    public Instant startedAt;

    /** Last viewer heartbeat; a session without heartbeats is closed by the sweeper */
    @Column(nullable = false)
    public Instant lastHeartbeatAt;

    public Instant endedAt;

    /** USER_STOPPED, TIME_LIMIT, NO_HEARTBEAT */
    @Column(length = 24)
    public String endReason;
}
