package com.inurum.dashcam.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Driver record for fleet management and driver-to-vehicle/event assignment.
 */
@Entity
@Table(name = "drivers", indexes = {
        @Index(name = "idx_drivers_tenant", columnList = "tenantId"),
        @Index(name = "idx_drivers_license", columnList = "licenseNumber")
})
public class DriverEntity {

    @Id
    @Column(length = 64)
    public String id;

    @Column(nullable = false, length = 64)
    public String tenantId;

    @Column(nullable = false, length = 120)
    public String name;

    @Column(length = 32)
    public String phone;

    @Column(length = 120)
    public String email;

    @Column(length = 50)
    public String licenseNumber;

    @Column(length = 32)
    public String licenseState;

    /** ACTIVE, INACTIVE, ON_DUTY, OFF_DUTY */
    @Column(length = 32)
    public String status = "ACTIVE";

    /** ID of currently assigned vehicle */
    @Column(length = 64)
    public String assignedVehicleId;

    @Column(nullable = false)
    public boolean active = true;

    @Column(nullable = false)
    public Instant createdAt;

    public Instant updatedAt;
}

