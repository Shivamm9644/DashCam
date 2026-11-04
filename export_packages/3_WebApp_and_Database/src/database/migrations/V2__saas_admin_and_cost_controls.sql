-- =====================================================================
-- Migration V2: SaaS Administration, RBAC & Low-Cost Storage Engine
-- Target Plan: INR 500 / Vehicle / Year Budget Optimization
-- Engine: MySQL 8.0+ / MariaDB 10.5+
-- =====================================================================

USE `dashcam_db`;

-- 1. Enhance Tenants Table with Subscription, Expiry & Billing Status
ALTER TABLE `tenants`
    ADD COLUMN IF NOT EXISTS `subscription_plan` VARCHAR(32) DEFAULT 'INR_500_ANNUAL',
    ADD COLUMN IF NOT EXISTS `subscription_start` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS `subscription_expiry` TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS `billing_status` VARCHAR(24) DEFAULT 'ACTIVE', -- ACTIVE, TRIAL, PAST_DUE, SUSPENDED
    ADD COLUMN IF NOT EXISTS `max_vehicles` INT DEFAULT 100,
    ADD COLUMN IF NOT EXISTS `monthly_live_minutes_cap` INT DEFAULT 120,
    ADD COLUMN IF NOT EXISTS `storage_cap_mb` INT DEFAULT 51200; -- 50 GB default cap per org

-- 2. Customer User Vehicle Access Control Table (Restricted Scoped Permissions)
CREATE TABLE IF NOT EXISTS `user_vehicle_permissions` (
    `id` VARCHAR(64) PRIMARY KEY,
    `user_id` VARCHAR(64) NOT NULL,
    `tenant_id` VARCHAR(64) NOT NULL,
    `terminal_id` VARCHAR(32) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_perm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_perm_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
    UNIQUE KEY `uk_user_terminal_perm` (`user_id`, `terminal_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Device-to-Vehicle 1:1 Hardware Exclusivity Constraint
-- Ensures a dashcam terminal IMEI can never be paired to multiple vehicles concurrently
ALTER TABLE `vehicles`
    ADD CONSTRAINT `uk_vehicle_terminal_device` UNIQUE (`terminal_id`);

-- 4. Cost Controls & Quota Ledger Table
CREATE TABLE IF NOT EXISTS `tenant_cost_controls` (
    `tenant_id` VARCHAR(64) PRIMARY KEY,
    `target_annual_cost_inr` INT DEFAULT 500,
    `live_stream_duration_sec` INT DEFAULT 120,
    `monthly_streaming_minutes_quota` INT DEFAULT 120,
    `concurrent_stream_limit` INT DEFAULT 2,
    `media_retention_days` INT DEFAULT 7,
    `safety_incident_retention_days` INT DEFAULT 30,
    `storage_cap_mb_per_vehicle` INT DEFAULT 5120,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_cost_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Fleet Performance & Utilization Aggregates Table
CREATE TABLE IF NOT EXISTS `fleet_utilization_daily` (
    `id` VARCHAR(64) PRIMARY KEY,
    `tenant_id` VARCHAR(64) NOT NULL,
    `terminal_id` VARCHAR(32) NOT NULL,
    `report_date` DATE NOT NULL,
    `operating_hours` DOUBLE DEFAULT 0.0,
    `driving_hours` DOUBLE DEFAULT 0.0,
    `idle_hours` DOUBLE DEFAULT 0.0,
    `parked_hours` DOUBLE DEFAULT 0.0,
    `distance_km` DOUBLE DEFAULT 0.0,
    `overspeed_events` INT DEFAULT 0,
    `harsh_braking_events` INT DEFAULT 0,
    `socket_uptime_pct` DOUBLE DEFAULT 100.0,
    `storage_consumed_bytes` BIGINT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_utilization_day` (`terminal_id`, `report_date`),
    INDEX `idx_util_tenant_date` (`tenant_id`, `report_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Initial Seed Cost Controls for Existing Tenants
INSERT IGNORE INTO `tenant_cost_controls` (`tenant_id`, `target_annual_cost_inr`, `live_stream_duration_sec`, `monthly_streaming_minutes_quota`, `concurrent_stream_limit`, `media_retention_days`)
VALUES
    ('ten-001', 500, 120, 120, 2, 7),
    ('tenant-apex', 500, 120, 120, 2, 7),
    ('tenant-bluedart', 500, 120, 120, 2, 7),
    ('tenant-retail', 500, 120, 60, 1, 7);
