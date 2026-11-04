package com.inurum.dashcam.entity;

import jakarta.persistence.*;

/**
 * A user restricted to specific cameras. A user with no rows sees every vehicle of their tenant.
 */
@Entity
@Table(name = "user_vehicle_access")
public class UserVehicleAccessEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false, length = 64)
    public String userId;

    @Column(nullable = false, length = 32)
    public String terminalId;

    public UserVehicleAccessEntity() {
    }

    public UserVehicleAccessEntity(String userId, String terminalId) {
        this.userId = userId;
        this.terminalId = terminalId;
    }
}
