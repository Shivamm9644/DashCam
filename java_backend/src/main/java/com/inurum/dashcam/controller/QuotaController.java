package com.inurum.dashcam.controller;

import com.inurum.dashcam.entity.CostControlEntity;
import com.inurum.dashcam.repository.TenantRepository;
import com.inurum.dashcam.security.CurrentUser;
import com.inurum.dashcam.service.AccessService;
import com.inurum.dashcam.service.CostControlService;
import com.inurum.dashcam.service.LiveService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import static com.inurum.dashcam.web.Json.obj;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Plan & quota")
public class QuotaController {

    public static final int PRICE_PER_DEVICE_YEAR_INR = 500;

    private final LiveService live;
    private final CostControlService costControls;
    private final AccessService access;
    private final TenantRepository tenants;

    public QuotaController(LiveService live, CostControlService costControls, AccessService access, TenantRepository tenants) {
        this.live = live;
        this.costControls = costControls;
        this.access = access;
        this.tenants = tenants;
    }

    @GetMapping("/quotas")
    @Operation(summary = "Live minutes used this month vs. allowance (paired cameras × minutes per camera)")
    public Map<String, Object> quotas(HttpServletRequest req) {
        CurrentUser user = CurrentUser.from(req);
        long devices;
        double used, max;
        if (user.isSuperAdmin()) {
            devices = 0;
            max = 0;
            for (var t : tenants.findAll()) {
                CostControlEntity c = costControls.forTenant(t.id);
                devices += access.camerasOfTenant(t.id);
                max += live.maxLiveMinutes(t.id, c);
            }
            used = live.minutesUsedThisMonth(null);
        } else {
            CostControlEntity c = costControls.forTenant(user.tenantId());
            devices = access.camerasOfTenant(user.tenantId());
            max = live.maxLiveMinutes(user.tenantId(), c);
            used = live.minutesUsedThisMonth(user.tenantId());
        }
        return obj(
                "pricePerDeviceYearInr", PRICE_PER_DEVICE_YEAR_INR,
                "quota", obj(
                        "deviceCount", devices,
                        "liveMinutesUsed", used,
                        "maxLiveMinutes", max,
                        "remainingLiveMinutes", Math.max(0, Math.round((max - used) * 10.0) / 10.0)));
    }
}
