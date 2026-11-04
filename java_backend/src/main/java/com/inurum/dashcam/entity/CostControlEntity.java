package com.inurum.dashcam.entity;

import jakarta.persistence.*;

/**
 * Per-tenant limits that keep the plan at ₹500 per vehicle per year.
 */
@Entity
@Table(name = "cost_controls")
public class CostControlEntity {

    @Id
    @Column(length = 64)
    public String tenantId;

    /** A live session is stopped after this long */
    @Column(nullable = false)
    public int maxStreamDurationSeconds = 120;

    /** Live minutes allowed per vehicle per month */
    @Column(nullable = false)
    public int monthlyStreamingQuotaMinutes = 30;

    @Column(nullable = false)
    public int maxConcurrentStreams = 2;

    @Column(nullable = false)
    public int routineVideoRetentionDays = 7;

    @Column(nullable = false)
    public int incidentVideoRetentionDays = 30;

    @Column(nullable = false)
    public long lastPurgeBytesCleaned;

    public CostControlEntity() {
    }

    public CostControlEntity(String tenantId) {
        this.tenantId = tenantId;
    }
}
