package com.inurum.dashcam.repository;

import com.inurum.dashcam.entity.TripEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TripRepository extends JpaRepository<TripEntity, String> {

    List<TripEntity> findAllByOrderByStartTimeDesc();

    Page<TripEntity> findAllByOrderByStartTimeDesc(Pageable pageable);

    Page<TripEntity> findByTenantIdOrderByStartTimeDesc(String tenantId, Pageable pageable);

    Page<TripEntity> findByStartTimeBetweenOrderByStartTimeDesc(Instant start, Instant end, Pageable pageable);

    Page<TripEntity> findByTenantIdAndStartTimeBetweenOrderByStartTimeDesc(
            String tenantId, Instant start, Instant end, Pageable pageable);

    Page<TripEntity> findByTerminalIdAndStartTimeBetweenOrderByStartTimeDesc(
            String terminalId, Instant start, Instant end, Pageable pageable);

    Optional<TripEntity> findByIdAndTenantId(String id, String tenantId);
}
