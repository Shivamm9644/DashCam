package com.inurum.dashcam.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "trips", indexes = {
        @Index(name = "idx_trips_terminal", columnList = "terminalId"),
        @Index(name = "idx_trips_tenant", columnList = "tenantId"),
        @Index(name = "idx_trips_start_time", columnList = "startTime DESC")
})
public class TripEntity {

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

    @Column(nullable = false)
    public Instant startTime;

    public Instant endTime;

    @Column(length = 255)
    public String startLocation;

    @Column(length = 255)
    public String endLocation;

    public Double distanceKm;
    public Double maxSpeedKmH;
    public Double avgSpeedKmH;

    public Double startOdometerKm;
    public Double endOdometerKm;

    @Column(length = 20)
    public String odometerSource = "GPS_ESTIMATED";

    /** GPS breadcrumbs as a JSON array of {timestamp, lat, lng, speed, heading} */
    @Lob
    @Column(columnDefinition = "LONGTEXT")
    public String pointsJson;
}
