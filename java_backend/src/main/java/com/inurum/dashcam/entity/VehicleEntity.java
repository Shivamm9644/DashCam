package com.inurum.dashcam.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * A fleet vehicle and the dashcam (JT808 terminal id) paired to it.
 * Includes validated 17-character VIN, IMEI, driver assignment, and odometer tracking.
 */
@Entity
@Table(name = "vehicles", indexes = {
        @Index(name = "idx_vehicles_tenant", columnList = "tenantId"),
        @Index(name = "idx_vehicles_vin", columnList = "vin", unique = true),
        @Index(name = "idx_vehicles_terminal", columnList = "assignedDeviceId", unique = true),
        @Index(name = "idx_vehicles_imei", columnList = "imei")
})
public class VehicleEntity {

    @Id
    @Column(length = 64)
    public String id;

    @Column(nullable = false, length = 64)
    public String tenantId;

    @Column(nullable = false, length = 32)
    public String plateNumber;

    /** 17-character standard vehicle identification number (VIN) */
    @Column(length = 17)
    public String vin;

    /** DashCam 15-digit IMEI number */
    @Column(length = 32)
    public String imei;

    @Column(length = 160)
    public String label;

    /** Vehicle make/model typed by the admin */
    @Column(length = 80)
    public String model;

    @Column(name = "model_year")
    public Integer year;

    /** Assigned driver ID referencing DriverEntity */
    @Column(length = 64)
    public String driverId;

    @Column(length = 120)
    public String driverName;

    @Column(length = 32)
    public String driverPhone;

    @Column(length = 40)
    public String driverLicense;

    /** Current vehicle odometer reading in kilometers */
    public Double odometerKm;

    /** Source of odometer data: ECU (OBD-II/CAN-bus) or GPS_ESTIMATED (accumulated distance) */
    @Column(length = 20)
    public String odometerSource = "GPS_ESTIMATED";

    @Column(length = 32)
    public String fuelType;

    /** Paired JT808 terminal id; unique so one camera belongs to one vehicle */
    @Column(unique = true, length = 32)
    public String assignedDeviceId;

    /** false = DEACTIVATED by an admin */
    @Column(nullable = false)
    public boolean active = true;

    /** Created automatically when an unknown camera connected to the gateway */
    @Column(nullable = false)
    public boolean autoDiscovered;

    @Column(nullable = false)
    public Instant createdAt;

    public Instant updatedAt;
}
