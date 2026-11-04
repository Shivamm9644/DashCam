package com.inurum.dashcam.repository;

import com.inurum.dashcam.entity.TenantEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TenantRepository extends JpaRepository<TenantEntity, String> {
    boolean existsByCode(String code);
}
