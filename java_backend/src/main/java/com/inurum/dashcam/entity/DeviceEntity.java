package com.inurum.dashcam.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * DashCam hardware terminal metadata, protocol version, and connectivity lifecycle.
 */
@Entity
@Table(name = "devices", indexes = {
        @Index(name = "idx_devices_imei", columnList = "imei"),
        @Index(name = "idx_devices_tenant", columnList = "tenantId")
})
public class DeviceEntity {

    @Id
    @Column(length = 32)
    public String terminalId;

    @Column(length = 32)
    public String imei;

    @Column(length = 64)
    public String serialNumber;

    @Column(length = 80)
    public String model;

    @Column(length = 80)
    public String firmware;

    @Column(length = 32)
    public String simNo;

    @Column(length = 32)
    public String protocolVersion = "JT/T 808-2013";

    /** ONLINE, OFFLINE */
    @Column(length = 20)
    public String status = "OFFLINE";

    public Instant lastOnline;

    @Column(length = 64)
    public String tenantId;

    @Column(nullable = false)
    public Instant createdAt;

    public Instant updatedAt;
}

