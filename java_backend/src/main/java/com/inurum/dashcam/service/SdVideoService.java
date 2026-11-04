package com.inurum.dashcam.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.inurum.dashcam.dto.SdCardFileDto;
import com.inurum.dashcam.dto.SdCardQueryResponse;
import com.inurum.dashcam.dto.VideoRetrievalJobDto;
import com.inurum.dashcam.entity.SafetyEventEntity;
import com.inurum.dashcam.entity.VehicleEntity;
import com.inurum.dashcam.entity.VideoRetrievalJobEntity;
import com.inurum.dashcam.gateway.GatewayClient;
import com.inurum.dashcam.repository.SafetyEventRepository;
import com.inurum.dashcam.repository.VehicleRepository;
import com.inurum.dashcam.repository.VideoRetrievalJobRepository;
import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.inurum.dashcam.web.Json.obj;

/**
 * Footage lives primarily on the camera's MicroSD card (FAT32, loop recording).
 * "Query" lists the video files on the card via JT/T 1078 0x9205.
 * "Retrieve" issues JT/T 1078 0x9201 playback command to the camera, creating a tracked retrieval job.
 */
@Service
public class SdVideoService {

    private static final Pattern TIME = Pattern.compile("^(\\d{4}-\\d{2}-\\d{2})[ T](\\d{2}:\\d{2}:\\d{2})");
    private static final DateTimeFormatter CAMERA_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final Duration JOB_EXPIRATION = Duration.ofHours(4);

    private final GatewayClient gateway;
    private final AccessService access;
    private final AuditService audit;
    private final VideoRetrievalJobRepository jobRepository;
    private final VehicleRepository vehicleRepository;
    private final SafetyEventRepository safetyEventRepository;

    /** Last SD listing per camera, served by /video/recordings */
    private final Map<String, List<Map<String, Object>>> lastListing = new ConcurrentHashMap<>();

    public SdVideoService(GatewayClient gateway, AccessService access, AuditService audit,
                          VideoRetrievalJobRepository jobRepository, VehicleRepository vehicleRepository,
                          SafetyEventRepository safetyEventRepository) {
        this.gateway = gateway;
        this.access = access;
        this.audit = audit;
        this.jobRepository = jobRepository;
        this.vehicleRepository = vehicleRepository;
        this.safetyEventRepository = safetyEventRepository;
    }

    /**
     * Parse and format camera time string into 'yyyy-MM-dd HH:mm:ss'
     */
    public static String cameraTime(String value, String field) {
        Matcher m = value == null ? null : TIME.matcher(value.trim());
        if (m == null || !m.find()) {
            throw ApiException.badRequest("BAD_TIME", field + " must look like 2026-10-30T14:05:00 or 2026-10-30 14:05:00");
        }
        return m.group(1) + " " + m.group(2);
    }

    public Map<String, Object> query(CurrentUser user, String terminalId, int channel, String startTime, String endTime) {
        access.requireTerminal(user, terminalId);
        String start = cameraTime(startTime, "startTime"), end = cameraTime(endTime, "endTime");
        JsonNode res = gateway.sdList(terminalId, 0, start, end);

        List<Map<String, Object>> files = new ArrayList<>();
        if (res != null && res.has("files")) {
            for (JsonNode f : res.path("files")) {
                int ch = f.path("channel").asInt();
                String fs = f.path("start").asText(), fe = f.path("end").asText();
                files.add(obj(
                        "id", terminalId + "_" + ch + "_" + fs.replaceAll("\\D", ""),
                        "terminalId", terminalId,
                        "channel", ch,
                        "startTime", fs.replace(' ', 'T'),
                        "endTime", fe.replace(' ', 'T'),
                        "duration", duration(fs, fe),
                        "fileSizeBytes", f.path("fileSizeBytes").asLong(),
                        "storageSource", "SD_CARD"));
            }
        }
        lastListing.put(terminalId, files);
        audit.record(user.id(), user.tenantId(), "QUERY_SD_CARD", terminalId, Map.of("start", start, "end", end, "files", files.size()));

        List<Map<String, Object>> forChannel = files.stream()
                .filter(f -> channel == 0 || (int) f.get("channel") == channel)
                .toList();
        return obj("terminalId", terminalId, "availableResources", forChannel.size(), "resources", forChannel);
    }

    public SdCardQueryResponse queryTyped(CurrentUser user, String terminalId, int channel, String startTime, String endTime) {
        Map<String, Object> raw = query(user, terminalId, channel, startTime, endTime);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> resList = (List<Map<String, Object>>) raw.get("resources");
        List<SdCardFileDto> dtos = new ArrayList<>();
        if (resList != null) {
            for (Map<String, Object> m : resList) {
                dtos.add(new SdCardFileDto(
                        (String) m.get("id"),
                        (String) m.get("terminalId"),
                        (int) m.get("channel"),
                        (String) m.get("startTime"),
                        (String) m.get("endTime"),
                        (String) m.get("duration"),
                        ((Number) m.get("fileSizeBytes")).longValue(),
                        (String) m.get("storageSource")
                ));
            }
        }
        return new SdCardQueryResponse(terminalId, dtos.size(), dtos);
    }

    public List<Map<String, Object>> recordings(CurrentUser user, String terminalId, Integer channel) {
        access.requireTerminal(user, terminalId);
        return lastListing.getOrDefault(terminalId, List.of()).stream()
                .filter(f -> channel == null || channel == 0 || (int) f.get("channel") == channel)
                .toList();
    }

    @Transactional
    public VideoRetrievalJobDto retrieve(CurrentUser user, String terminalId, int channel, String startTime,
                                         String endTime, String safetyEventId) {
        access.requireTerminal(user, terminalId);
        String start = cameraTime(startTime, "startTime"), end = cameraTime(endTime, "endTime");

        // Start SD playback on camera via gateway (JT/T 1078 0x9201)
        gateway.playbackStart(terminalId, String.valueOf(channel), start, end);

        String jobId = "sd-" + terminalId + "-" + System.currentTimeMillis();
        Instant now = Instant.now();
        Instant expiresAt = now.plus(JOB_EXPIRATION);

        String roadUrl = LiveService.streamUrl(terminalId, 1);
        String cabinUrl = LiveService.streamUrl(terminalId, 2);
        String primaryUrl = LiveService.streamUrl(terminalId, channel > 0 ? channel : 1);

        String vehId = vehicleRepository.findByAssignedDeviceId(terminalId)
                .map(v -> v.id)
                .orElse(null);

        VideoRetrievalJobEntity job = new VideoRetrievalJobEntity();
        job.id = jobId;
        job.tenantId = user.tenantId();
        job.terminalId = terminalId;
        job.vehicleId = vehId;
        job.channel = channel;
        job.startTime = start.replace(' ', 'T');
        job.endTime = end.replace(' ', 'T');
        job.status = "READY"; // Streaming is active immediately on the gateway HLS pipeline
        job.progress = 100;
        job.videoUrl = primaryUrl;
        job.roadChannelUrl = roadUrl;
        job.cabinChannelUrl = cabinUrl;
        job.safetyEventId = safetyEventId;
        job.createdAt = now;
        job.updatedAt = now;
        job.expiresAt = expiresAt;

        jobRepository.save(job);

        // If associated with a safety event, update the event record with video proof URLs
        if (safetyEventId != null && !safetyEventId.isBlank()) {
            safetyEventRepository.findById(safetyEventId).ifPresent(ev -> {
                ev.mediaStatus = "READY";
                ev.videoUrl = primaryUrl;
                ev.roadChannelUrl = roadUrl;
                ev.cabinChannelUrl = cabinUrl;
                ev.mediaExpiresAt = expiresAt;
                safetyEventRepository.save(ev);
            });
        }

        audit.record(user.id(), user.tenantId(), "SD_PLAYBACK", terminalId,
                Map.of("start", start, "end", end, "channel", channel, "jobId", jobId));

        return toJobDto(job);
    }

    public JsonNode sdFiles(CurrentUser user, String terminalId, int channel, String start, String end) {
        access.requireTerminal(user, terminalId);
        return gateway.sdList(terminalId, channel, cameraTime(start, "start"), cameraTime(end, "end"));
    }

    public JsonNode playbackStart(CurrentUser user, String terminalId, String channel, String start, String end) {
        access.requireTerminal(user, terminalId);
        if (!channel.matches("all|1|2")) throw ApiException.badRequest("BAD_CHANNEL", "channel must be 1, 2 or all.");
        JsonNode res = gateway.playbackStart(terminalId, channel, cameraTime(start, "start"), cameraTime(end, "end"));
        audit.record(user.id(), user.tenantId(), "SD_PLAYBACK", terminalId, Map.of("start", start, "end", end, "channel", channel));
        return res;
    }

    public JsonNode playbackStop(CurrentUser user, String terminalId, String channel) {
        access.requireTerminal(user, terminalId);
        return gateway.playbackStop(terminalId, channel);
    }

    public VideoRetrievalJobDto getJob(CurrentUser user, String jobId) {
        VideoRetrievalJobEntity job = jobRepository.findById(jobId).orElse(null);
        if (job == null || (!user.isSuperAdmin() && !job.tenantId.equals(user.tenantId()))) {
            throw ApiException.notFound("JOB_NOT_FOUND", "No such SD retrieval job.");
        }
        access.requireTerminal(user, job.terminalId);
        return toJobDto(job);
    }

    public List<VideoRetrievalJobDto> listJobs(CurrentUser user) {
        List<VideoRetrievalJobEntity> list = user.isSuperAdmin()
                ? jobRepository.findAll()
                : jobRepository.findByTenantIdOrderByCreatedAtDesc(user.tenantId());
        return list.stream().map(this::toJobDto).toList();
    }

    private VideoRetrievalJobDto toJobDto(VideoRetrievalJobEntity j) {
        return new VideoRetrievalJobDto(
                j.id,
                j.tenantId,
                j.terminalId,
                j.vehicleId,
                j.channel,
                j.startTime,
                j.endTime,
                j.status,
                j.progress,
                j.videoUrl,
                j.roadChannelUrl,
                j.cabinChannelUrl,
                j.errorMessage,
                j.safetyEventId,
                j.createdAt,
                j.updatedAt,
                j.expiresAt,
                "READY".equals(j.status) ? "Playing from the dashcam SD card." : "Retrieval status: " + j.status
        );
    }

    private static String duration(String start, String end) {
        try {
            long sec = Duration.between(LocalDateTime.parse(start, CAMERA_TIME), LocalDateTime.parse(end, CAMERA_TIME)).getSeconds();
            return String.format("%02d:%02d", sec / 60, sec % 60);
        } catch (Exception e) {
            return null;
        }
    }
}
