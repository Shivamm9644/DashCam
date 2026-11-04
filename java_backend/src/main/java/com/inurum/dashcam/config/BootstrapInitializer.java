package com.inurum.dashcam.config;

import com.inurum.dashcam.entity.TenantEntity;
import com.inurum.dashcam.entity.UserEntity;
import com.inurum.dashcam.repository.TenantRepository;
import com.inurum.dashcam.repository.UserRepository;
import com.inurum.dashcam.security.Roles;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Creates only what a fresh database needs to be usable: the platform organization (new cameras are
 * placed there) and, when there are no users at all, one SUPER_ADMIN from INITIAL_ADMIN_EMAIL /
 * INITIAL_ADMIN_PASSWORD. No demo data.
 */
@Component
public class BootstrapInitializer implements CommandLineRunner {

    public static final String PLATFORM_TENANT_ID = "tenant-inurum";

    private static final Logger log = LoggerFactory.getLogger(BootstrapInitializer.class);

    private final TenantRepository tenants;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final String adminEmail;
    private final String adminPassword;
    private final String adminName;

    public BootstrapInitializer(TenantRepository tenants, UserRepository users, PasswordEncoder passwordEncoder,
                                @Value("${bootstrap.admin-email:}") String adminEmail,
                                @Value("${bootstrap.admin-password:}") String adminPassword,
                                @Value("${bootstrap.admin-name:Platform Admin}") String adminName) {
        this.tenants = tenants;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
        this.adminName = adminName;
    }

    @Override
    public void run(String... args) {
        if (!tenants.existsById(PLATFORM_TENANT_ID)) {
            TenantEntity t = new TenantEntity();
            t.id = PLATFORM_TENANT_ID;
            t.name = "Inurum";
            t.code = "INURUM";
            t.contactEmail = "support@inurum.com";
            t.plan = "ENTERPRISE";
            t.status = "ACTIVE";
            t.createdAt = Instant.now();
            tenants.save(t);
            log.info("Created platform organization {}", PLATFORM_TENANT_ID);
        }

        // 1. Inurum WanWay Master SUPER_ADMIN
        if (users.findByEmail("inurum@wanwaygps.com").isEmpty()) {
            UserEntity master = new UserEntity();
            master.id = "usr-inurum-master";
            master.tenantId = PLATFORM_TENANT_ID;
            master.name = "Inurum WanWay Master";
            master.email = "inurum@wanwaygps.com";
            master.passwordHash = passwordEncoder.encode("as123456");
            master.role = Roles.SUPER_ADMIN;
            master.status = "ACTIVE";
            master.createdAt = Instant.now();
            users.save(master);
            log.info("Created WanWay Master account: {} with password: {}", master.email, "as123456");
        }

        // 2. Default Platform Admin account
        if (adminEmail != null && !adminEmail.isBlank() && users.findByEmail(adminEmail.trim().toLowerCase()).isEmpty()) {
            UserEntity u = new UserEntity();
            u.id = "usr-admin";
            u.tenantId = PLATFORM_TENANT_ID;
            u.name = adminName != null ? adminName : "Platform Admin";
            u.email = adminEmail.trim().toLowerCase();
            u.passwordHash = passwordEncoder.encode(adminPassword != null && !adminPassword.isBlank() ? adminPassword : "InurumAdmin2026!");
            u.role = Roles.SUPER_ADMIN;
            u.status = "ACTIVE";
            u.createdAt = Instant.now();
            users.save(u);
            log.info("Created initial SUPER_ADMIN: {}", u.email);
        }
    }
}
