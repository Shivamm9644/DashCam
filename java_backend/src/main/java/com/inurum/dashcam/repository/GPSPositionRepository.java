package com.inurum.dashcam.repository;

import com.inurum.dashcam.entity.GPSPositionEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;

public interface GPSPositionRepository extends JpaRepository<GPSPositionEntity, Long> {

    Page<GPSPositionEntity> findByTerminalIdAndTimestampBetweenOrderByTimestampDesc(
            String terminalId, Instant start, Instant end, Pageable pageable);

    Page<GPSPositionEntity> findByVehicleIdAndTimestampBetweenOrderByTimestampDesc(
            String vehicleId, Instant start, Instant end, Pageable pageable);

    Page<GPSPositionEntity> findByTenantIdAndTimestampBetweenOrderByTimestampDesc(
            String tenantId, Instant start, Instant end, Pageable pageable);

    Optional<GPSPositionEntity> findTopByTerminalIdOrderByTimestampDesc(String terminalId);

    Optional<GPSPositionEntity> findTopByVehicleIdOrderByTimestampDesc(String vehicleId);
}

