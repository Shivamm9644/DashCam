package com.inurum.dashcam.controller;

import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.service.LiveService;
import com.inurum.dashcam.web.Body;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

import static com.inurum.dashcam.web.Json.obj;

@RestController
@RequestMapping("/api/v1/live-sessions")
@Tag(name = "Live video")
public class LiveController {

    private final LiveService live;

    public LiveController(LiveService live) {
        this.live = live;
    }

    @PostMapping
    @Operation(summary = "Start live video (JT1078 0x9101). 409 if the camera is offline, 402 if the monthly quota is used up")
    public Map<String, Object> start(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        Integer channel = Body.integer(body, "channelId");
        return live.start(CurrentUser.from(req), Body.required(body, "terminalId"), channel == null ? 1 : channel);
    }

    @PostMapping("/heartbeat")
    @Operation(summary = "Viewer still watching; active=false once the time limit is reached. Without heartbeats the stream stops after 30s")
    public Map<String, Object> heartbeat(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        return live.heartbeat(CurrentUser.from(req), Body.required(body, "terminalId"));
    }

    @PostMapping("/stop")
    @Operation(summary = "Stop live video (JT1078 0x9102)")
    public Map<String, Object> stop(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        String terminalId = Body.required(body, "terminalId");
        live.stop(CurrentUser.from(req), terminalId);
        return obj("success", true, "terminalId", terminalId, "message", "Live stream stopped.");
    }
}
