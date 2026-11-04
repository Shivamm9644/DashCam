package com.inurum.dashcam.repository;

import com.inurum.dashcam.entity.AuditLogEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLogEntity, Long> {
    List<AuditLogEntity> findAllByOrderByTimestampDesc(Pageable page);

    List<AuditLogEntity> findByTenantIdOrderByTimestampDesc(String tenantId, Pageable page);
}
