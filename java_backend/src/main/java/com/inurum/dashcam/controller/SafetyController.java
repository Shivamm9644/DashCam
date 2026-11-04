package com.inurum.dashcam.controller;

import com.inurum.dashcam.dto.PagedResponse;
import com.inurum.dashcam.dto.SafetyEventDto;
import com.inurum.dashcam.dto.SafetyRecordingUrlResponse;
import com.inurum.dashcam.entity.SafetyEventEntity;
import com.inurum.dashcam.entity.VehicleEntity;
import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.service.SafetyService;
import com.inurum.dashcam.web.ApiException;
import com.inurum.dashcam.web.Body;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static com.inurum.dashcam.web.Json.obj;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Safety events & evidence", description = "DashCam ADAS/DMS safety incident detection, triage review and video proof retrieval")
public class SafetyController {

    private final SafetyService safety;

    public SafetyController(SafetyService safety) {
        this.safety = safety;
    }

    @GetMapping({"/events", "/safety/events", "/safety/incidents"})
    @Operation(summary = "Camera alarm events with complete vehicle association, VIN, odometer and media availability")
    public Map<String, Object> list(HttpServletRequest req,
                                    @RequestParam(required = false) String type,
                                    @RequestParam(required = false) String severity,
                                    @RequestParam(required = false) String status,
                                    @RequestParam(required = false) String terminalId,
                                    @RequestParam(required = false) String vehicleId) {
        Map<String, VehicleEntity> byTerminal = safety.vehiclesByTerminal();
        List<Map<String, Object>> list = safety.visible(CurrentUser.from(req)).stream()
                .filter(e -> all(type) || type.equalsIgnoreCase(e.type))
                .filter(e -> all(severity) || severity.equalsIgnoreCase(e.severity))
                .filter(e -> all(status) || status.equalsIgnoreCase(e.triageStatus))
                .filter(e -> all(terminalId) || terminalId.equals(e.terminalId))
                .filter(e -> all(vehicleId) || (e.vehicleId != null && e.vehicleId.equals(vehicleId)))
                .map(e -> safety.view(e, byTerminal))
                .toList();
        return obj("success", true, "events", list, "incidents", list, "total", list.size());
    }

    @GetMapping({"/safety/events/{id}", "/safety/incidents/{id}"})
    @Operation(summary = "Get single safety event by ID with vehicle association, VIN and video proof state")
    public Map<String, Object> get(HttpServletRequest req, @PathVariable String id) {
        Map<String, Object> view = safety.view(safety.require(CurrentUser.from(req), id), safety.vehiclesByTerminal());
        return obj("success", true, "incident", view, "event", view);
    }

    @GetMapping({"/safety/recording-url", "/safety/events/{id}/recording-url", "/safety/incidents/{id}/recording-url"})
    @Operation(summary = "Get documented video proof URLs (road/cabin HLS streams, media status, and expiration) for a safety event")
    public SafetyRecordingUrlResponse recordingUrl(
            HttpServletRequest req,
            @PathVariable(required = false) String id,
            @RequestParam(required = false) String eventId) {

        String targetId = id != null ? id : eventId;
        if (targetId == null || targetId.isBlank()) {
            throw ApiException.badRequest("MISSING_EVENT_ID", "eventId or path {id} is required.");
        }
        return safety.getRecordingUrl(CurrentUser.from(req), targetId);
    }

    @PostMapping("/safety/incidents/{id}/review")
    @Operation(summary = "Set triage status (NEEDS_REVIEW, COACHED, RECOGNIZED, DISMISSED) with coaching notes")
    public Map<String, Object> review(HttpServletRequest req, @PathVariable String id,
                                      @RequestBody(required = false) Map<String, Object> body) {
        SafetyEventEntity e = safety.review(CurrentUser.from(req), id,
                Body.str(body, "status"), Body.str(body, "notes"), Body.str(body, "coachingCategory"));
        return obj("success", true, "status", e.triageStatus, "incident", safety.view(e, safety.vehiclesByTerminal()));
    }

    private static boolean all(String filter) {
        return filter == null || filter.isBlank() || "ALL".equalsIgnoreCase(filter);
    }
}
