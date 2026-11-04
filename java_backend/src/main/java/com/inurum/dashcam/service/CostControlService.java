package com.inurum.dashcam.service;

import com.inurum.dashcam.entity.CostControlEntity;
import com.inurum.dashcam.repository.CostControlRepository;
import org.springframework.stereotype.Service;

import java.util.Map;

import static com.inurum.dashcam.web.Json.obj;

@Service
public class CostControlService {

    private final CostControlRepository repository;

    public CostControlService(CostControlRepository repository) {
        this.repository = repository;
    }

    /** The tenant's limits; a tenant that never saved any gets the defaults */
    public CostControlEntity forTenant(String tenantId) {
        return repository.findById(tenantId).orElseGet(() -> new CostControlEntity(tenantId));
    }

    public CostControlEntity save(CostControlEntity e) {
        return repository.save(e);
    }

    public static Map<String, Object> view(CostControlEntity c) {
        return obj(
                "tenantId", c.tenantId,
                "maxStreamDurationSeconds", c.maxStreamDurationSeconds,
                "monthlyStreamingQuotaMinutes", c.monthlyStreamingQuotaMinutes,
                "maxConcurrentStreams", c.maxConcurrentStreams,
                "routineVideoRetentionDays", c.routineVideoRetentionDays,
                "incidentVideoRetentionDays", c.incidentVideoRetentionDays,
                "lastPurgeBytesCleaned", c.lastPurgeBytesCleaned);
    }
}
