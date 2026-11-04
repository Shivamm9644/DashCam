package com.inurum.dashcam.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "tenants")
public class TenantEntity {

    @Id
    @Column(length = 64)
    public String id;

    @Column(nullable = false, length = 160)
    public String name;

    @Column(nullable = false, unique = true, length = 32)
    public String code;

    @Column(length = 160)
    public String contactEmail;

    /** INR_500_ANNUAL or ENTERPRISE (index.html selectOrgPlan) */
    @Column(length = 32)
    public String plan;

    /** ACTIVE or SUSPENDED */
    @Column(nullable = false, length = 16)
    public String status;

    public Instant subscriptionEnd;

    @Column(nullable = false)
    public Instant createdAt;
}
