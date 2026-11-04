package com.inurum.dashcam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inurum.dashcam.entity.AuditLogEntity;
import com.inurum.dashcam.repository.AuditLogRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

@Service
public class AuditService {

    private final AuditLogRepository repository;
    private final ObjectMapper objectMapper;

    public AuditService(AuditLogRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    public void record(String actorId, String tenantId, String action, String resource, Map<String, ?> details) {
        AuditLogEntity e = new AuditLogEntity();
        e.timestamp = Instant.now();
        e.actorId = actorId;
        e.tenantId = tenantId;
        e.action = action;
        e.resource = resource;
        try {
            String json = details == null ? null : objectMapper.writeValueAsString(details);
            e.details = json != null && json.length() > 2000 ? json.substring(0, 2000) : json;
        } catch (Exception ignored) {
            e.details = null;
        }
        repository.save(e);
    }
}
