package com.inurum.dashcam.repository;

import com.inurum.dashcam.entity.DiscoveredTerminalEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DiscoveredTerminalRepository extends JpaRepository<DiscoveredTerminalEntity, String> {
}
