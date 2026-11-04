package com.inurum.dashcam.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "users")
public class UserEntity {

    @Id
    @Column(length = 64)
    public String id;

    @Column(nullable = false, length = 64)
    public String tenantId;

    @Column(nullable = false, length = 160)
    public String name;

    /** Stored lower-case; also the login name */
    @Column(nullable = false, unique = true, length = 160)
    public String email;

    /** BCrypt hash. Never returned by the API. */
    @Column(nullable = false, length = 100)
    public String passwordHash;

    @Column(nullable = false, length = 32)
    public String role;

    /** ACTIVE or INACTIVE */
    @Column(nullable = false, length = 16)
    public String status;

    @Column(nullable = false)
    public Instant createdAt;

    public Instant lastLoginAt;
}
