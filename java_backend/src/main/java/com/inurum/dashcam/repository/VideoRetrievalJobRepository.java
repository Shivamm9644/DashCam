package com.inurum.dashcam.repository;

import com.inurum.dashcam.entity.VideoRetrievalJobEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VideoRetrievalJobRepository extends JpaRepository<VideoRetrievalJobEntity, String> {

    List<VideoRetrievalJobEntity> findByTenantIdOrderByCreatedAtDesc(String tenantId);

    Page<VideoRetrievalJobEntity> findByTenantIdOrderByCreatedAtDesc(String tenantId, Pageable pageable);

    List<VideoRetrievalJobEntity> findByTerminalIdOrderByCreatedAtDesc(String terminalId);

    Optional<VideoRetrievalJobEntity> findByIdAndTenantId(String id, String tenantId);

    List<VideoRetrievalJobEntity> findByStatus(String status);
}

