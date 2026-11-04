package com.inurum.dashcam.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "audit_logs")
public class AuditLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public Instant timestamp;

    @Column(nullable = false, length = 160)
    public String actorId;

    @Column(length = 64)
    public String tenantId;

    @Column(nullable = false, length = 48)
    public String action;

    @Column(length = 160)
    public String resource;

    /** JSON object */
    @Column(length = 2000)
    public String details;
}
