package com.inurum.dashcam.repository;

import com.inurum.dashcam.entity.DriverEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DriverRepository extends JpaRepository<DriverEntity, String> {
    List<DriverEntity> findByTenantId(String tenantId);

    Page<DriverEntity> findByTenantId(String tenantId, Pageable pageable);

    Optional<DriverEntity> findByIdAndTenantId(String id, String tenantId);

    Optional<DriverEntity> findByLicenseNumber(String licenseNumber);

    Optional<DriverEntity> findByAssignedVehicleId(String vehicleId);
}

