package com.inurum.dashcam.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * A camera that has connected to the gateway at least once. Auto-discovery creates a vehicle only
 * the first time, so a camera an admin unpaired does not come back as a new vehicle.
 */
@Entity
@Table(name = "discovered_terminals")
public class DiscoveredTerminalEntity {

    @Id
    @Column(length = 32)
    public String terminalId;

    @Column(nullable = false)
    public Instant firstSeenAt;

    public DiscoveredTerminalEntity() {
    }

    public DiscoveredTerminalEntity(String terminalId, Instant firstSeenAt) {
        this.terminalId = terminalId;
        this.firstSeenAt = firstSeenAt;
    }
}
