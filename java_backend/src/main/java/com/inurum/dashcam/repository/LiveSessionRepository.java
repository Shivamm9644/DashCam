package com.inurum.dashcam.repository;

import com.inurum.dashcam.entity.LiveSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface LiveSessionRepository extends JpaRepository<LiveSessionEntity, String> {
    List<LiveSessionEntity> findByEndedAtIsNull();

    List<LiveSessionEntity> findByTerminalIdAndEndedAtIsNull(String terminalId);

    List<LiveSessionEntity> findByStartedAtAfter(Instant since);
}
