package com.inurum.dashcam.repository;

import com.inurum.dashcam.entity.DeviceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DeviceRepository extends JpaRepository<DeviceEntity, String> {

    List<DeviceEntity> findByTenantId(String tenantId);

    Optional<DeviceEntity> findByImei(String imei);

    Optional<DeviceEntity> findByTerminalId(String terminalId);
}

