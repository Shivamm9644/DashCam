package com.inurum.dashcam.gateway;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inurum.dashcam.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * HTTP client for the Node JT808/JT1078 gateway, which owns the camera sockets. Everything this
 * backend knows about a camera being online, its GPS, live video and SD footage comes from here.
 */
@Component
public class GatewayClient {

    private static final Logger log = LoggerFactory.getLogger(GatewayClient.class);

    private static final Duration DEVICE_CACHE_TTL = Duration.ofSeconds(5);
    // Each start-live makes the camera restart both channel streams (~3s of lost video), so one
    // "Start Live" click that asks for CH1 and CH2 must only reach the camera once.
    private static final long LIVE_DISPATCH_DEDUP_MS = 20_000;

    private final String baseUrl;
    private final ObjectMapper objectMapper;
    // HTTP/1.1 only: the default h2c upgrade header makes the gateway's socket.io drop the connection
    private final HttpClient http = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(2))
            .build();

    private volatile Map<String, GatewayDevice> deviceCache = Map.of();
    private volatile Instant deviceCacheAt = Instant.EPOCH;
    private volatile boolean reachable;
    private final Map<String, Long> lastLiveDispatch = new ConcurrentHashMap<>();

    public GatewayClient(@Value("${gateway.url}") String baseUrl, ObjectMapper objectMapper) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.objectMapper = objectMapper;
    }

    /** Status of the last device fetch; false means the device data below is stale or empty */
    public boolean isReachable() {
        return reachable;
    }

    /**
     * All terminals the gateway knows, by terminal id. Cached for a few seconds; on a gateway outage
     * the last known list is returned with every device marked offline.
     */
    public synchronized Map<String, GatewayDevice> devices() {
        if (Duration.between(deviceCacheAt, Instant.now()).compareTo(DEVICE_CACHE_TTL) < 0) return deviceCache;
        try {
            JsonNode list = get("/api/devices", Duration.ofSeconds(3)).body;
            Map<String, GatewayDevice> fresh = new LinkedHashMap<>();
            if (list != null && list.isArray()) {
                for (JsonNode d : list) {
                    String id = text(d, "deviceId");
                    if (id == null) continue;
                    double lat = d.path("latitude").asDouble(0), lng = d.path("longitude").asDouble(0);
                    boolean fix = lat != 0 && lng != 0;
                    fresh.put(id, new GatewayDevice(
                            id,
                            "online".equalsIgnoreCase(text(d, "status")),
                            parseInstant(text(d, "lastOnline")),
                            fix ? lat : null,
                            fix ? lng : null,
                            d.path("speed").asDouble(0),
                            text(d, "deviceType"),
                            text(d, "firmware"),
                            "-".equals(text(d, "simNo")) ? null : text(d, "simNo"),
                            text(d, "vehicleNo")));
                }
            }
            deviceCache = fresh;
            reachable = true;
        } catch (Exception e) {
            if (reachable) log.warn("Gateway unreachable at {}: {}", baseUrl, e.getMessage());
            reachable = false;
            Map<String, GatewayDevice> stale = new LinkedHashMap<>();
            deviceCache.forEach((id, d) -> stale.put(id, new GatewayDevice(id, false, d.lastOnline(), null, null, 0,
                    d.deviceType(), d.firmware(), d.simNo(), d.vehicleNo())));
            deviceCache = stale;
        }
        deviceCacheAt = Instant.now();
        return deviceCache;
    }

    public Optional<GatewayDevice> device(String terminalId) {
        return Optional.ofNullable(devices().get(terminalId));
    }

    public boolean isOnline(String terminalId) {
        return device(terminalId).map(GatewayDevice::online).orElse(false);
    }

    /**
     * Sends JT1078 0x9101 (live start, both channels) unless it was sent for this camera in the last 20s.
     */
    public void startLive(String terminalId) {
        long now = System.currentTimeMillis();
        Long last = lastLiveDispatch.get(terminalId);
        if (last != null && now - last < LIVE_DISPATCH_DEDUP_MS) return;
        lastLiveDispatch.put(terminalId, now);
        call("/api/video/start-live?terminalId=" + enc(terminalId) + "&channel=1&dataType=0", Duration.ofSeconds(3));
    }

    /** Sends JT1078 0x9102 (close live stream) */
    public void stopLive(String terminalId) {
        lastLiveDispatch.remove(terminalId);
        try {
            get("/api/video/stop-live?terminalId=" + enc(terminalId), Duration.ofSeconds(3));
        } catch (Exception e) {
            log.warn("Live stop for {} did not reach the gateway: {}", terminalId, e.getMessage());
        }
    }

    /**
     * SD card file list (JT1078 0x9205 → 0x1205). Times are camera-local "YYYY-MM-DD HH:mm:ss".
     * The camera can take a few seconds to answer.
     */
    public JsonNode sdList(String terminalId, int channel, String start, String end) {
        return call("/api/video/sd-list?terminalId=" + enc(terminalId) + "&channel=" + channel
                + "&start=" + enc(start) + "&end=" + enc(end), Duration.ofSeconds(10));
    }

    /** SD card playback (0x9201); the clip streams to /media/live/<id>_<ch>/live.m3u8 like live video */
    public JsonNode playbackStart(String terminalId, String channel, String start, String end) {
        return call("/api/video/playback-start?terminalId=" + enc(terminalId) + "&channel=" + enc(channel)
                + "&start=" + enc(start) + "&end=" + enc(end), Duration.ofSeconds(10));
    }

    /** Ends SD playback (0x9202) on the given channel or "all" */
    public JsonNode playbackStop(String terminalId, String channel) {
        return call("/api/video/playback-stop?terminalId=" + enc(terminalId) + "&channel=" + enc(channel), Duration.ofSeconds(3));
    }

    /**
     * Alarm events the gateway derived from camera reports, newer than since (ISO time, null = all).
     * Empty when the gateway has no events endpoint (alarm-events.js not deployed) or is down.
     */
    public List<JsonNode> events(String since) {
        try {
            Result r = get("/api/events" + (since != null ? "?since=" + enc(since) : ""), Duration.ofSeconds(3));
            if (r.status != 200 || r.body == null || !r.body.path("events").isArray()) return List.of();
            List<JsonNode> out = new ArrayList<>();
            r.body.path("events").forEach(out::add);
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * GET that turns a gateway error answer (offline camera, bad time, no SD answer) into the same
     * HTTP error for our caller, and an unreachable gateway into 502.
     */
    private JsonNode call(String pathAndQuery, Duration timeout) {
        Result r;
        try {
            r = get(pathAndQuery, timeout);
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "GATEWAY_UNREACHABLE", "The dashcam gateway is not reachable.");
        }
        if (r.status >= 400) {
            String code = r.body != null && r.body.hasNonNull("error") ? r.body.get("error").asText() : "GATEWAY_ERROR";
            String msg = r.body != null && r.body.hasNonNull("message") ? r.body.get("message").asText() : "Gateway error " + r.status;
            HttpStatus status = HttpStatus.resolve(r.status);
            throw new ApiException(status != null ? status : HttpStatus.BAD_GATEWAY, code, msg);
        }
        return r.body;
    }

    private record Result(int status, JsonNode body) {
    }

    private Result get(String pathAndQuery, Duration timeout) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + pathAndQuery)).timeout(timeout).GET().build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        JsonNode body = null;
        try {
            body = objectMapper.readTree(res.body());
        } catch (Exception ignored) {
            // non-JSON answer
        }
        return new Result(res.statusCode(), body);
    }

    private static String enc(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() || v.asText().isBlank() ? null : v.asText();
    }

    private static Instant parseInstant(String s) {
        if (s == null) return null;
        try {
            return Instant.parse(s);
        } catch (Exception e) {
            return null;
        }
    }
}
