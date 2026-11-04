package com.inurum.dashcam.repository;

import com.inurum.dashcam.entity.VehicleEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VehicleRepository extends JpaRepository<VehicleEntity, String> {

    List<VehicleEntity> findByTenantId(String tenantId);

    Page<VehicleEntity> findByTenantId(String tenantId, Pageable pageable);

    Optional<VehicleEntity> findByIdAndTenantId(String id, String tenantId);

    Optional<VehicleEntity> findByAssignedDeviceId(String terminalId);

    Optional<VehicleEntity> findByVin(String vin);

    Optional<VehicleEntity> findByPlateNumber(String plateNumber);

    Optional<VehicleEntity> findByImei(String imei);

    List<VehicleEntity> findByDriverId(String driverId);
}
