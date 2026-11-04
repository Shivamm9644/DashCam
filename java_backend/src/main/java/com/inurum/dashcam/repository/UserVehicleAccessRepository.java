package com.inurum.dashcam.repository;

import com.inurum.dashcam.entity.UserVehicleAccessEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface UserVehicleAccessRepository extends JpaRepository<UserVehicleAccessEntity, Long> {
    List<UserVehicleAccessEntity> findByUserId(String userId);

    @Transactional
    void deleteByUserId(String userId);
}
