package com.inurum.dashcam.service;

import com.inurum.dashcam.entity.CostControlEntity;
import com.inurum.dashcam.entity.LiveSessionEntity;
import com.inurum.dashcam.entity.VehicleEntity;
import com.inurum.dashcam.gateway.GatewayClient;
import com.inurum.dashcam.gateway.GatewayDevice;
import com.inurum.dashcam.repository.LiveSessionRepository;
import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.*;
import java.util.*;

import static com.inurum.dashcam.web.Json.obj;

/**
 * Live video over the camera's 4G SIM, which is billed per MB: every session has a hard time
 * limit, counts against the monthly minutes quota, and is stopped as soon as nobody is watching.
 */
@Service
public class LiveService {

    private static final Logger log = LoggerFactory.getLogger(LiveService.class);
    private static final Duration HEARTBEAT_TIMEOUT = Duration.ofSeconds(30);
    private static final ZoneId BILLING_ZONE = ZoneId.of("Asia/Kolkata");

    private final LiveSessionRepository sessions;
    private final AccessService access;
    private final CostControlService costControls;
    private final GatewayClient gateway;
    private final AuditService audit;

    public LiveService(LiveSessionRepository sessions, AccessService access, CostControlService costControls,
                       GatewayClient gateway, AuditService audit) {
        this.sessions = sessions;
        this.access = access;
        this.costControls = costControls;
        this.gateway = gateway;
        this.audit = audit;
    }

    public static String streamUrl(String terminalId, int channel) {
        return "/media/live/" + terminalId + "_" + channel + "/live.m3u8";
    }

    public Map<String, Object> start(CurrentUser user, String terminalId, int channel) {
        VehicleEntity vehicle = access.requireTerminal(user, terminalId).orElse(null);
        if (vehicle != null && !vehicle.active) {
            throw new ApiException(HttpStatus.CONFLICT, "VEHICLE_DEACTIVATED", "This vehicle is deactivated.");
        }
        String tenantId = vehicle != null ? vehicle.tenantId : user.tenantId();
        GatewayDevice device = gateway.device(terminalId).orElse(null);
        if (device == null || !device.online()) {
            throw new ApiException(HttpStatus.CONFLICT, "DEVICE_OFFLINE",
                    "Dashcam is not connected to the gateway (JT808 port 7800). Check the camera's server IP/port and SIM data."
                            + (device != null && device.lastOnline() != null ? " Last online: " + device.lastOnline() : ""));
        }

        CostControlEntity limits = costControls.forTenant(tenantId);
        double maxMinutes = maxLiveMinutes(tenantId, limits);
        double used = minutesUsedThisMonth(tenantId);
        if (used >= maxMinutes) {
            throw new ApiException(HttpStatus.PAYMENT_REQUIRED, "QUOTA_EXHAUSTED",
                    String.format("Monthly live allowance used up (%.1f of %.0f minutes).", used, maxMinutes));
        }

        Instant now = Instant.now();
        // One session per camera: the gateway always streams both channels, so CH1 + CH2 is one view
        LiveSessionEntity session = sessions.findByTerminalIdAndEndedAtIsNull(terminalId).stream().findFirst().orElse(null);
        if (session == null) {
            long camerasLive = sessions.findByEndedAtIsNull().stream()
                    .filter(s -> s.tenantId.equals(tenantId)).map(s -> s.terminalId).distinct().count();
            if (camerasLive >= limits.maxConcurrentStreams) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "CONCURRENT_LIMIT",
                        "Already " + camerasLive + " camera(s) live; the limit is " + limits.maxConcurrentStreams + ".");
            }
            session = new LiveSessionEntity();
            session.id = "live-" + terminalId + "-" + now.toEpochMilli();
            session.tenantId = tenantId;
            session.userId = user.id();
            session.terminalId = terminalId;
            session.channel = channel;
            session.startedAt = now;
            audit.record(user.id(), tenantId, "START_LIVE_VIEW", terminalId, Map.of("sessionId", session.id));
        }
        session.lastHeartbeatAt = now;
        sessions.save(session);
        gateway.startLive(terminalId);

        long remainingSec = Math.max(0, limits.maxStreamDurationSeconds - Duration.between(session.startedAt, now).getSeconds());
        return obj(
                "sessionId", session.id,
                "terminalId", terminalId,
                "channelId", channel,
                "streamUrl", streamUrl(terminalId, channel),
                "streamUrlM3u8", streamUrl(terminalId, channel),
                "timeToLiveSeconds", remainingSec,
                "remainingLiveMinutes", round1(maxMinutes - used));
    }

    /**
     * Keeps a session alive while a viewer is on the page. Answers active=false (and stops the camera)
     * once the session's time limit is reached.
     */
    public Map<String, Object> heartbeat(CurrentUser user, String terminalId) {
        access.requireTerminal(user, terminalId);
        List<LiveSessionEntity> open = sessions.findByTerminalIdAndEndedAtIsNull(terminalId);
        if (open.isEmpty()) return obj("active", false, "remainingSeconds", 0, "message", "No live session for this camera.");

        Instant now = Instant.now();
        long remaining = Long.MAX_VALUE;
        for (LiveSessionEntity s : open) {
            int limit = costControls.forTenant(s.tenantId).maxStreamDurationSeconds;
            long left = limit - Duration.between(s.startedAt, now).getSeconds();
            if (left <= 0) {
                end(s, "TIME_LIMIT");
            } else {
                s.lastHeartbeatAt = now;
                sessions.save(s);
                remaining = Math.min(remaining, left);
            }
        }
        if (remaining == Long.MAX_VALUE) {
            gateway.stopLive(terminalId);
            return obj("active", false, "remainingSeconds", 0, "message", "Live time limit reached.");
        }
        return obj("active", true, "remainingSeconds", remaining);
    }

    public void stop(CurrentUser user, String terminalId) {
        access.requireTerminal(user, terminalId);
        for (LiveSessionEntity s : sessions.findByTerminalIdAndEndedAtIsNull(terminalId)) end(s, "USER_STOPPED");
        gateway.stopLive(terminalId);
        audit.record(user.id(), user.tenantId(), "STOP_LIVE_VIEW", terminalId, Map.of());
    }

    /** Stops cameras whose viewers closed the page or ran past the time limit */
    @Scheduled(initialDelay = 15_000, fixedDelay = 10_000)
    public void sweep() {
        Instant now = Instant.now();
        Set<String> stopped = new HashSet<>();
        for (LiveSessionEntity s : sessions.findByEndedAtIsNull()) {
            int limit = costControls.forTenant(s.tenantId).maxStreamDurationSeconds;
            if (Duration.between(s.startedAt, now).getSeconds() >= limit) {
                end(s, "TIME_LIMIT");
                stopped.add(s.terminalId);
            } else if (Duration.between(s.lastHeartbeatAt, now).compareTo(HEARTBEAT_TIMEOUT) > 0) {
                end(s, "NO_HEARTBEAT");
                stopped.add(s.terminalId);
            }
        }
        for (String terminalId : stopped) {
            if (sessions.findByTerminalIdAndEndedAtIsNull(terminalId).isEmpty()) {
                log.info("Stopping live video of {} (time limit or no viewer)", terminalId);
                gateway.stopLive(terminalId);
            }
        }
    }

    private void end(LiveSessionEntity s, String reason) {
        s.endedAt = Instant.now();
        s.endReason = reason;
        sessions.save(s);
    }

    /** Live minutes of a tenant since the 1st of this month (IST); null tenant = all tenants */
    public double minutesUsedThisMonth(String tenantId) {
        Instant monthStart = LocalDate.now(BILLING_ZONE).withDayOfMonth(1).atStartOfDay(BILLING_ZONE).toInstant();
        Instant now = Instant.now();
        double seconds = 0;
        for (LiveSessionEntity s : sessions.findByStartedAtAfter(monthStart)) {
            if (tenantId != null && !tenantId.equals(s.tenantId)) continue;
            seconds += Duration.between(s.startedAt, s.endedAt != null ? s.endedAt : now).getSeconds();
        }
        return round1(seconds / 60.0);
    }

    /** Quota = paired cameras of the tenant × monthly minutes per camera */
    public double maxLiveMinutes(String tenantId, CostControlEntity limits) {
        long cameras = access.camerasOfTenant(tenantId);
        return (double) cameras * limits.monthlyStreamingQuotaMinutes;
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
