package com.inurum.dashcam.controller;

import com.inurum.dashcam.entity.*;
import com.inurum.dashcam.gateway.GatewayClient;
import com.inurum.dashcam.gateway.GatewayDevice;
import com.inurum.dashcam.repository.TenantRepository;
import com.inurum.dashcam.repository.TripRepository;
import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.service.AccessService;
import com.inurum.dashcam.service.CostControlService;
import com.inurum.dashcam.service.FleetService;
import com.inurum.dashcam.service.LiveService;
import com.inurum.dashcam.service.SafetyService;
import com.inurum.dashcam.web.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

import static com.inurum.dashcam.web.Json.obj;

/**
 * Reports computed only from recorded data: trips, camera alarm events, live sessions and the
 * gateway's connection state. Figures the system does not record (fuel, idle time, a "fleet score")
 * are null rather than invented.
 */
@RestController
@RequestMapping("/api/v1/reports")
@Tag(name = "Reports")
public class ReportController {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final AccessService access;
    private final TripRepository trips;
    private final SafetyService safety;
    private final GatewayClient gateway;
    private final LiveService live;
    private final CostControlService costControls;
    private final TenantRepository tenants;
    private final int jt808Port;

    public ReportController(AccessService access, TripRepository trips, SafetyService safety, GatewayClient gateway,
                            LiveService live, CostControlService costControls, TenantRepository tenants,
                            @Value("${gateway.jt808-port}") int jt808Port) {
        this.access = access;
        this.trips = trips;
        this.safety = safety;
        this.gateway = gateway;
        this.live = live;
        this.costControls = costControls;
        this.tenants = tenants;
        this.jt808Port = jt808Port;
    }

    @GetMapping("/summary")
    @Operation(summary = "type: fleet_utilization, vehicle_activity, speeding, safety_trends, device_connectivity, storage_usage")
    public Map<String, Object> summary(HttpServletRequest req,
                                       @RequestParam(defaultValue = "fleet_utilization") String type,
                                       @RequestParam(required = false) String terminalId,
                                       @RequestParam(required = false) String startDate,
                                       @RequestParam(required = false) String endDate) {
        return obj("report", build(CurrentUser.from(req), type, terminalId, startDate, endDate));
    }

    @GetMapping("/export-csv")
    public ResponseEntity<String> exportCsv(HttpServletRequest req,
                                            @RequestParam(defaultValue = "fleet_utilization") String type,
                                            @RequestParam(required = false) String terminalId,
                                            @RequestParam(required = false) String startDate,
                                            @RequestParam(required = false) String endDate) {
        Map<String, Object> report = build(CurrentUser.from(req), type, terminalId, startDate, endDate);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> records = (List<Map<String, Object>>) report.get("records");
        StringBuilder csv = new StringBuilder();
        if (records.isEmpty()) {
            csv.append("No data for the selected filters.\n");
        } else {
            List<String> headers = new ArrayList<>(records.get(0).keySet());
            csv.append(headers.stream().map(ReportController::csvCell).collect(Collectors.joining(","))).append('\n');
            for (Map<String, Object> r : records) {
                csv.append(headers.stream().map(h -> csvCell(r.get(h))).collect(Collectors.joining(","))).append('\n');
            }
        }
        String filename = "report_" + type.replaceAll("[^a-z_]", "") + "_" + LocalDate.now(IST) + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8))
                .body(csv.toString());
    }

    private Map<String, Object> build(CurrentUser user, String type, String terminalId, String startDate, String endDate) {
        Instant from = day(startDate, false), to = day(endDate, true);
        List<VehicleEntity> vehicles = access.visibleVehicles(user).stream()
                .filter(v -> blank(terminalId) || terminalId.equals(v.assignedDeviceId)).toList();
        Set<String> terminals = vehicles.stream().map(v -> v.assignedDeviceId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<String, VehicleEntity> byTerminal = new HashMap<>();
        vehicles.forEach(v -> { if (v.assignedDeviceId != null) byTerminal.put(v.assignedDeviceId, v); });

        List<TripEntity> tripList = trips.findAllByOrderByStartTimeDesc().stream()
                .filter(t -> terminals.contains(t.terminalId) && inRange(t.startTime, from, to)).toList();
        List<SafetyEventEntity> eventList = safety.visible(user).stream()
                .filter(e -> terminals.contains(e.terminalId) && inRange(e.timestamp, from, to)).toList();

        return switch (type) {
            case "fleet_utilization" -> utilization(vehicles, tripList, byTerminal);
            case "vehicle_activity" -> activity(vehicles, tripList);
            case "speeding" -> speeding(eventList, byTerminal);
            case "safety_trends" -> safetyTrends(eventList, byTerminal);
            case "device_connectivity" -> connectivity(vehicles);
            case "storage_usage" -> storage(user);
            default -> throw ApiException.badRequest("BAD_REPORT_TYPE", "Unknown report type: " + type);
        };
    }

    private Map<String, Object> utilization(List<VehicleEntity> vehicles, List<TripEntity> tripList, Map<String, VehicleEntity> byTerminal) {
        // One row per vehicle per day, from recorded trips
        Map<String, Map<String, Object>> rows = new LinkedHashMap<>();
        double totalHours = 0, totalKm = 0;
        for (TripEntity t : tripList) {
            double hours = t.endTime == null ? 0 : Duration.between(t.startTime, t.endTime).toMinutes() / 60.0;
            double km = t.distanceKm == null ? 0 : t.distanceKm;
            totalHours += hours;
            totalKm += km;
            String date = LocalDate.ofInstant(t.startTime, IST).toString();
            VehicleEntity v = byTerminal.get(t.terminalId);
            Map<String, Object> row = rows.computeIfAbsent(date + "|" + t.terminalId, k -> obj(
                    "date", date, "plateNumber", v != null ? v.plateNumber : t.terminalId, "terminalId", t.terminalId,
                    "engineHours", 0.0, "idleHours", null, "distanceKm", 0.0, "maxSpeedKmH", 0.0));
            row.put("engineHours", round1((double) row.get("engineHours") + hours));
            row.put("distanceKm", round1((double) row.get("distanceKm") + km));
            if (t.maxSpeedKmH != null) row.put("maxSpeedKmH", Math.max((double) row.get("maxSpeedKmH"), t.maxSpeedKmH));
        }
        return obj("reportType", "fleet_utilization", "totalVehicles", vehicles.size(),
                "totalEngineHours", round1(totalHours), "totalDistanceKm", round1(totalKm),
                "fleetScore", null, "records", new ArrayList<>(rows.values()));
    }

    private Map<String, Object> activity(List<VehicleEntity> vehicles, List<TripEntity> tripList) {
        Map<String, GatewayDevice> devices = gateway.devices();
        List<Map<String, Object>> records = new ArrayList<>();
        double total = 0;
        for (VehicleEntity v : vehicles) {
            double km = tripList.stream().filter(t -> t.terminalId.equals(v.assignedDeviceId) && t.distanceKm != null)
                    .mapToDouble(t -> t.distanceKm).sum();
            total += km;
            GatewayDevice d = v.assignedDeviceId == null ? null : devices.get(v.assignedDeviceId);
            String status = FleetService.status(v, d);
            records.add(obj("plateNumber", v.plateNumber, "terminalId", v.assignedDeviceId, "status", status,
                    "distanceKm", round1(km), "speed", "ONLINE".equals(status) ? d.speed() : 0, "fuelSensor", null));
        }
        double maxSpeed = tripList.stream().filter(t -> t.maxSpeedKmH != null).mapToDouble(t -> t.maxSpeedKmH).max().orElse(0);
        return obj("reportType", "vehicle_activity", "totalVehicles", vehicles.size(), "totalDistanceKm", round1(total),
                "maxSpeedRecorded", maxSpeed, "activeTrips", tripList.stream().filter(t -> t.endTime == null).count(),
                "records", records);
    }

    private Map<String, Object> speeding(List<SafetyEventEntity> events, Map<String, VehicleEntity> byTerminal) {
        List<SafetyEventEntity> speed = events.stream().filter(e -> "OVERSPEED".equals(e.type)).toList();
        long braking = events.stream().filter(e -> e.type.contains("BRAK")).count();
        List<Map<String, Object>> records = speed.stream().map(e -> eventRow(e, byTerminal)).toList();
        return obj("reportType", "speeding", "speedingEventsCount", speed.size(),
                "maxSpeedObserved", speed.stream().filter(e -> e.speed != null).mapToDouble(e -> e.speed).max().orElse(0),
                "harshBrakingCount", braking, "complianceRate", null, "records", records);
    }

    private Map<String, Object> safetyTrends(List<SafetyEventEntity> events, Map<String, VehicleEntity> byTerminal) {
        long coached = events.stream().filter(e -> "COACHED".equals(e.triageStatus)).count();
        return obj("reportType", "safety_trends", "totalIncidents", events.size(),
                "criticalIncidents", events.stream().filter(e -> "CRITICAL".equalsIgnoreCase(e.severity)).count(),
                "coachedPercentage", events.isEmpty() ? 0 : Math.round(coached * 100.0 / events.size()),
                "pendingTriage", events.stream().filter(e -> "NEEDS_REVIEW".equals(e.triageStatus)).count(),
                "records", events.stream().map(e -> eventRow(e, byTerminal)).toList());
    }

    private Map<String, Object> connectivity(List<VehicleEntity> vehicles) {
        Map<String, GatewayDevice> devices = gateway.devices();
        List<Map<String, Object>> records = new ArrayList<>();
        int online = 0;
        for (VehicleEntity v : vehicles) {
            if (v.assignedDeviceId == null) continue;
            GatewayDevice d = devices.get(v.assignedDeviceId);
            boolean on = d != null && d.online();
            if (on) online++;
            records.add(obj("terminalId", v.assignedDeviceId, "plateNumber", v.plateNumber, "status", on ? "ONLINE" : "OFFLINE",
                    "lastHeartbeat", d != null ? d.lastOnline() : null, "remoteIp", null, "remotePort", jt808Port));
        }
        return obj("reportType", "device_connectivity", "onlineTerminals", online, "offlineTerminals", records.size() - online,
                "socketStatus", gateway.isReachable() ? "Gateway reachable" : "Gateway unreachable",
                "availabilityRate", records.isEmpty() ? null : Math.round(online * 100.0 / records.size()),
                "records", records);
    }

    private Map<String, Object> storage(CurrentUser user) {
        List<Map<String, Object>> records = new ArrayList<>();
        double minutes = 0;
        for (TenantEntity t : tenants.findAll()) {
            if (!user.isSuperAdmin() && !t.id.equals(user.tenantId())) continue;
            CostControlEntity c = costControls.forTenant(t.id);
            double used = live.minutesUsedThisMonth(t.id);
            minutes += used;
            records.add(obj("tenantName", t.name, "storageUsedGb", 0, "storageQuotaGb", 0,
                    "streamingMinutesUsed", used, "streamingQuotaMinutes", live.maxLiveMinutes(t.id, c)));
        }
        return obj("reportType", "storage_usage", "totalStorageGb", 0, "streamingMinutesUsed", round1(minutes),
                "peakConcurrentStreams", null, "records", records);
    }

    private static Map<String, Object> eventRow(SafetyEventEntity e, Map<String, VehicleEntity> byTerminal) {
        VehicleEntity v = byTerminal.get(e.terminalId);
        return obj("timestamp", e.timestamp, "type", e.type, "plateNumber", v != null ? v.plateNumber : e.terminalId,
                "driverName", v != null ? v.driverName : null, "severity", e.severity, "speed", e.speed,
                "coached", "COACHED".equals(e.triageStatus), "coachingCategory", e.coachingCategory, "coachedBy", e.reviewedBy);
    }

    private static Instant day(String date, boolean endOfDay) {
        if (blank(date)) return null;
        try {
            LocalDate d = LocalDate.parse(date.substring(0, 10));
            return (endOfDay ? d.plusDays(1) : d).atStartOfDay(IST).toInstant();
        } catch (Exception e) {
            throw ApiException.badRequest("BAD_DATE", "Dates must be YYYY-MM-DD.");
        }
    }

    private static boolean inRange(Instant t, Instant from, Instant to) {
        return t != null && (from == null || !t.isBefore(from)) && (to == null || t.isBefore(to));
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank() || "ALL".equalsIgnoreCase(s);
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static String csvCell(Object v) {
        return v == null ? "\"\"" : "\"" + String.valueOf(v).replace("\"", "\"\"") + "\"";
    }
}
