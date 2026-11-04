package com.inurum.dashcam.controller;

import com.inurum.dashcam.dto.CreateDriverRequest;
import com.inurum.dashcam.dto.DriverDto;
import com.inurum.dashcam.dto.PagedResponse;
import com.inurum.dashcam.dto.UpdateDriverRequest;
import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.service.DriverService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import static com.inurum.dashcam.web.Json.obj;

@RestController
@RequestMapping("/api/v1/drivers")
@Tag(name = "Drivers", description = "Driver profiles, license verification, and vehicle assignment")
public class DriverController {

    private final DriverService driverService;

    public DriverController(DriverService driverService) {
        this.driverService = driverService;
    }

    @GetMapping
    @Operation(summary = "List all drivers with vehicle assignments and pagination")
    public PagedResponse<DriverDto> list(HttpServletRequest req,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "50") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 200), Sort.by(Sort.Direction.ASC, "name"));
        return driverService.list(CurrentUser.from(req), pageable);
    }

    @GetMapping("/all")
    @Operation(summary = "Get unpaginated list of all active fleet drivers")
    public Map<String, Object> listAll(HttpServletRequest req) {
        List<DriverDto> list = driverService.listAll(CurrentUser.from(req));
        return obj("drivers", list, "total", list.size());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get driver details by ID")
    public DriverDto get(HttpServletRequest req, @PathVariable String id) {
        return driverService.get(CurrentUser.from(req), id);
    }

    @PostMapping
    @Operation(summary = "Create / register a new driver")
    public ResponseEntity<DriverDto> create(HttpServletRequest req, @Valid @RequestBody CreateDriverRequest body) {
        DriverDto created = driverService.create(CurrentUser.from(req), body);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update driver details, license, contact info or vehicle assignment")
    public DriverDto update(HttpServletRequest req, @PathVariable String id, @RequestBody UpdateDriverRequest body) {
        return driverService.update(CurrentUser.from(req), id, body);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Deactivate a driver and unassign them from any vehicles")
    public Map<String, Object> delete(HttpServletRequest req, @PathVariable String id) {
        driverService.delete(CurrentUser.from(req), id);
        return obj("success", true, "message", "Driver deactivated.");
    }
}

