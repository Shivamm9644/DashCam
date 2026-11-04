package com.inurum.dashcam.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inurum.dashcam.dto.OdometerDto;
import com.inurum.dashcam.dto.PagedResponse;
import com.inurum.dashcam.dto.TripDto;
import com.inurum.dashcam.entity.TripEntity;
import com.inurum.dashcam.entity.VehicleEntity;
import com.inurum.dashcam.repository.TripRepository;
import com.inurum.dashcam.repository.VehicleRepository;
import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.service.AccessService;
import com.inurum.dashcam.web.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

import static com.inurum.dashcam.web.Json.obj;

@RestController
@RequestMapping("/api/v1/trips")
@Tag(name = "Trips", description = "Vehicle trip history, mileage, distance and GPS breadcrumb trails")
public class TripController {

    private final TripRepository trips;
    private final VehicleRepository vehicles;
    private final AccessService access;
    private final ObjectMapper objectMapper;

    public TripController(TripRepository trips, VehicleRepository vehicles, AccessService access, ObjectMapper objectMapper) {
        this.trips = trips;
        this.vehicles = vehicles;
        this.access = access;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    @Operation(summary = "Recorded trips with date-range filters, terminal ID and pagination")
    public PagedResponse<TripDto> list(
            HttpServletRequest req,
            @RequestParam(required = false) String terminalId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        CurrentUser user = CurrentUser.from(req);
        Pageable pageable = PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "startTime"));

        Page<TripEntity> tripPage;

        if (startDate != null && endDate != null) {
            if (terminalId != null && !terminalId.isBlank()) {
                access.requireTerminal(user, terminalId);
                tripPage = trips.findByTerminalIdAndStartTimeBetweenOrderByStartTimeDesc(terminalId, startDate, endDate, pageable);
            } else if (user.isSuperAdmin()) {
                tripPage = trips.findByStartTimeBetweenOrderByStartTimeDesc(startDate, endDate, pageable);
            } else {
                tripPage = trips.findByTenantIdAndStartTimeBetweenOrderByStartTimeDesc(user.tenantId(), startDate, endDate, pageable);
            }
        } else {
            if (terminalId != null && !terminalId.isBlank()) {
                access.requireTerminal(user, terminalId);
                tripPage = trips.findByTerminalIdAndStartTimeBetweenOrderByStartTimeDesc(
                        terminalId, Instant.EPOCH, Instant.now().plusSeconds(86400), pageable);
            } else if (user.isSuperAdmin()) {
                tripPage = trips.findAllByOrderByStartTimeDesc(pageable);
            } else {
                tripPage = trips.findByTenantIdOrderByStartTimeDesc(user.tenantId(), pageable);
            }
        }

        Map<String, VehicleEntity> byTerminal = new HashMap<>();
        for (VehicleEntity v : vehicles.findAll()) {
            if (v.assignedDeviceId != null) byTerminal.put(v.assignedDeviceId, v);
        }

        List<TripDto> dtos = tripPage.getContent().stream()
                .map(t -> toDto(t, byTerminal.get(t.terminalId)))
                .toList();

        return PagedResponse.of(dtos, pageable.getPageNumber(), pageable.getPageSize(), tripPage.getTotalElements());
    }

    @GetMapping("/summary")
    @Operation(summary = "Unpaginated trip summaries for dashboard widgets")
    public Map<String, Object> listSummary(HttpServletRequest req, @RequestParam(required = false) String terminalId) {
        CurrentUser user = CurrentUser.from(req);
        Set<String> visible = access.visibleTerminals(user);
        List<Map<String, Object>> list = trips.findAllByOrderByStartTimeDesc().stream()
                .filter(t -> user.isSuperAdmin() || visible.contains(t.terminalId))
                .filter(t -> terminalId == null || terminalId.isBlank() || terminalId.equals(t.terminalId))
                .map(this::summary)
                .toList();
        return obj("trips", list, "total", list.size());
    }

    @GetMapping("/{id}")
    @Operation(summary = "One trip with its GPS breadcrumb points, VIN, and odometer")
    public TripDto get(HttpServletRequest req, @PathVariable String id) {
        CurrentUser user = CurrentUser.from(req);
        TripEntity t = trips.findById(id).orElse(null);
        if (t == null || (!user.isSuperAdmin() && !access.visibleTerminals(user).contains(t.terminalId))) {
            throw ApiException.notFound("TRIP_NOT_FOUND", "Trip not found.");
        }
        VehicleEntity v = vehicles.findByAssignedDeviceId(t.terminalId).orElse(null);
        return toDto(t, v);
    }

    private TripDto toDto(TripEntity t, VehicleEntity v) {
        List<Object> points = List.of();
        if (t.pointsJson != null && !t.pointsJson.isBlank()) {
            try {
                points = objectMapper.readValue(t.pointsJson, List.class);
            } catch (Exception ignored) {
            }
        }

        String odoSource = t.odometerSource != null ? t.odometerSource : (v != null ? v.odometerSource : "GPS_ESTIMATED");

        return new TripDto(
                t.id,
                t.tenantId,
                t.terminalId,
                t.vehicleId != null ? t.vehicleId : (v != null ? v.id : null),
                t.vin != null ? t.vin : (v != null ? v.vin : null),
                v != null ? v.plateNumber : t.terminalId,
                t.driverId != null ? t.driverId : (v != null ? v.driverId : null),
                t.driverName != null ? t.driverName : (v != null ? v.driverName : null),
                t.startTime,
                t.endTime,
                t.startLocation,
                t.endLocation,
                t.distanceKm,
                t.maxSpeedKmH,
                t.avgSpeedKmH,
                OdometerDto.of(t.startOdometerKm != null ? t.startOdometerKm : (v != null ? v.odometerKm : 0.0), odoSource),
                OdometerDto.of(t.endOdometerKm != null ? t.endOdometerKm : (v != null ? v.odometerKm : 0.0), odoSource),
                points
        );
    }

    private Map<String, Object> summary(TripEntity t) {
        VehicleEntity v = vehicles.findByAssignedDeviceId(t.terminalId).orElse(null);
        return obj(
                "id", t.id,
                "tenantId", t.tenantId,
                "terminalId", t.terminalId,
                "vehicleId", v != null ? v.id : null,
                "vin", v != null ? v.vin : null,
                "plateNumber", v != null ? v.plateNumber : t.terminalId,
                "vehiclePlate", v != null ? v.plateNumber : t.terminalId,
                "vehicleLabel", v != null ? v.label : null,
                "driverName", v != null ? v.driverName : null,
                "startTime", t.startTime,
                "endTime", t.endTime,
                "startLocation", t.startLocation,
                "endLocation", t.endLocation,
                "distanceKm", t.distanceKm,
                "maxSpeed", t.maxSpeedKmH,
                "maxSpeedKmH", t.maxSpeedKmH,
                "avgSpeed", t.avgSpeedKmH,
                "avgSpeedKmH", t.avgSpeedKmH,
                "safetyEvents", List.of());
    }
}
