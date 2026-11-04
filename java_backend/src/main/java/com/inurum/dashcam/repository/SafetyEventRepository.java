package com.inurum.dashcam.repository;

import com.inurum.dashcam.entity.SafetyEventEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SafetyEventRepository extends JpaRepository<SafetyEventEntity, String> {

    List<SafetyEventEntity> findAllByOrderByTimestampDesc();

    Page<SafetyEventEntity> findAllByOrderByTimestampDesc(Pageable pageable);

    Page<SafetyEventEntity> findByTenantIdOrderByTimestampDesc(String tenantId, Pageable pageable);

    Page<SafetyEventEntity> findByTenantIdAndTimestampBetweenOrderByTimestampDesc(
            String tenantId, Instant start, Instant end, Pageable pageable);

    Page<SafetyEventEntity> findByTerminalIdAndTimestampBetweenOrderByTimestampDesc(
            String terminalId, Instant start, Instant end, Pageable pageable);

    Optional<SafetyEventEntity> findByIdAndTenantId(String id, String tenantId);
}
