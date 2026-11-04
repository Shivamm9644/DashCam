package com.inurum.dashcam.repository;

import com.inurum.dashcam.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<UserEntity, String> {
    Optional<UserEntity> findByEmail(String email);

    List<UserEntity> findByTenantId(String tenantId);
}
