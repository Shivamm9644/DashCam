package com.inurum.dashcam.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.inurum.dashcam.dto.SdCardQueryRequest;
import com.inurum.dashcam.dto.SdCardQueryResponse;
import com.inurum.dashcam.dto.SdCardRetrievalRequest;
import com.inurum.dashcam.dto.VideoRetrievalJobDto;
import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.service.SdVideoService;
import com.inurum.dashcam.web.Body;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import static com.inurum.dashcam.web.Json.obj;

/**
 * SD card video query and on-demand clip retrieval over JT/T 1078.
 */
@RestController
@RequestMapping("/api/v1/video")
@Tag(name = "SD card video", description = "Query local MicroSD loop recordings (0x9205) and retrieve video clips (0x9201/0x9206)")
public class VideoController {

    private final SdVideoService sd;

    public VideoController(SdVideoService sd) {
        this.sd = sd;
    }

    @PostMapping("/query-sd")
    @Operation(summary = "List recordings on camera's SD card between startTime and endTime (JT/T 1078 0x9205)")
    public SdCardQueryResponse query(HttpServletRequest req, @Valid @RequestBody SdCardQueryRequest body) {
        int ch = body.channel() != null ? body.channel() : 0;
        return sd.queryTyped(CurrentUser.from(req), body.terminalId(), ch, body.startTime(), body.endTime());
    }

    @GetMapping("/recordings")
    @Operation(summary = "Files found by the last SD card query of this camera")
    public Map<String, Object> recordings(HttpServletRequest req, @RequestParam String terminalId,
                                          @RequestParam(required = false) Integer channel) {
        List<Map<String, Object>> list = sd.recordings(CurrentUser.from(req), terminalId, channel);
        return obj("terminalId", terminalId, "recordings", list, "total", list.size());
    }

    @PostMapping("/retrieve")
    @Operation(summary = "Retrieve / play a time range from SD card (JT/T 1078 0x9201); returns job status and HLS stream URL")
    public VideoRetrievalJobDto retrieve(HttpServletRequest req, @Valid @RequestBody SdCardRetrievalRequest body) {
        int ch = body.channel() != null ? body.channel() : 1;
        return sd.retrieve(CurrentUser.from(req), body.terminalId(), ch,
                body.startTime(), body.endTime(), body.safetyEventId());
    }

    @GetMapping("/jobs")
    @Operation(summary = "List active and historical video retrieval jobs")
    public List<VideoRetrievalJobDto> listJobs(HttpServletRequest req) {
        return sd.listJobs(CurrentUser.from(req));
    }

    @GetMapping("/jobs/{id}")
    @Operation(summary = "Check status of an SD video retrieval job by ID")
    public VideoRetrievalJobDto job(HttpServletRequest req, @PathVariable String id) {
        return sd.getJob(CurrentUser.from(req), id);
    }

    @GetMapping("/sd-list")
    @Operation(summary = "Raw SD card files (camera-local times 'YYYY-MM-DD HH:mm:ss'); channel 0 = all")
    public JsonNode sdList(HttpServletRequest req, @RequestParam String terminalId,
                           @RequestParam(defaultValue = "0") int channel,
                           @RequestParam String start, @RequestParam String end) {
        return sd.sdFiles(CurrentUser.from(req), terminalId, channel, start, end);
    }

    @GetMapping("/playback-start")
    @Operation(summary = "Start SD playback (channel 1, 2 or all); streams to /media/live/<id>_<ch>/live.m3u8")
    public JsonNode playbackStart(HttpServletRequest req, @RequestParam String terminalId,
                                  @RequestParam(defaultValue = "all") String channel,
                                  @RequestParam String start, @RequestParam String end) {
        return sd.playbackStart(CurrentUser.from(req), terminalId, channel, start, end);
    }

    @GetMapping("/playback-stop")
    @Operation(summary = "Stop active SD card playback stream (JT/T 1078 0x9202)")
    public JsonNode playbackStop(HttpServletRequest req, @RequestParam String terminalId,
                                 @RequestParam(defaultValue = "all") String channel) {
        return sd.playbackStop(CurrentUser.from(req), terminalId, channel);
    }
}
