-- =====================================================================
-- Inurum Enterprise Dashcam & Telematics SaaS - MySQL Schema (v1.0)
-- Compatible with MySQL 8.0+ / MariaDB 10.5+
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `dashcam_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `dashcam_db`;

-- 1. Multi-Tenant Organizations
CREATE TABLE IF NOT EXISTS `tenants` (
    `id` VARCHAR(64) PRIMARY KEY,
    `name` VARCHAR(128) NOT NULL,
    `code` VARCHAR(32) UNIQUE NOT NULL,
    `contact_email` VARCHAR(128) NOT NULL,
    `plan` VARCHAR(32) DEFAULT 'INR_500_ANNUAL',
    `status` VARCHAR(24) DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. System & Tenant Users
CREATE TABLE IF NOT EXISTS `users` (
    `id` VARCHAR(64) PRIMARY KEY,
    `tenant_id` VARCHAR(64) NULL,
    `email` VARCHAR(128) UNIQUE NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(128) NOT NULL,
    `role` VARCHAR(32) NOT NULL DEFAULT 'FLEET_ADMIN',  
    `phone` VARCHAR(32) NULL,
    `status` VARCHAR(24) DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_users_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS `vehicles` (
    `entity_id` VARCHAR(64) PRIMARY KEY,
    `tenant_id` VARCHAR(64) NULL,
    `terminal_id` VARCHAR(32) UNIQUE NOT NULL, 
    `entity_name` VARCHAR(128) NOT NULL,
    `license_plate` VARCHAR(32) NOT NULL,
    `fleet_name` VARCHAR(128) DEFAULT 'Inurum Global Fleet',
    `device_status` VARCHAR(24) DEFAULT 'Active', 
    `dynamics_status` VARCHAR(24) DEFAULT 'Moving', 
    `driver_name` VARCHAR(128) NULL,
    `assigned_driver_id` VARCHAR(64) NULL,
    `speed` DOUBLE DEFAULT 0.0,
    `latitude` DOUBLE DEFAULT 18.5204,
    `longitude` DOUBLE DEFAULT 73.8567,
    `heading` DOUBLE DEFAULT 0.0,
    `ignition` BOOLEAN DEFAULT TRUE,
    `last_update` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_terminal_id` (`terminal_id`),
    INDEX `idx_license_plate` (`license_plate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. ADAS & DMS Safety Incidents
CREATE TABLE IF NOT EXISTS `safety_events` (
    `id` VARCHAR(64) PRIMARY KEY,
    `imei` VARCHAR(32) NOT NULL,
    `asset_name` VARCHAR(128) NOT NULL,
    `event_name` VARCHAR(128) NOT NULL,
    `event_category` VARCHAR(64) NOT NULL, 
    `severity` VARCHAR(24) NOT NULL, 
    `event_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `speed` DOUBLE DEFAULT 0.0,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `road_cam_video_url` TEXT NULL,
    `cabin_cam_video_url` TEXT NULL,
    INDEX `idx_event_imei` (`imei`),
    INDEX `idx_event_severity` (`severity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Historical Trips & Journeys
CREATE TABLE IF NOT EXISTS `trips` (
    `entity_id` VARCHAR(64) PRIMARY KEY,
    `imei` VARCHAR(32) NOT NULL,
    `asset_name` VARCHAR(128) NOT NULL,
    `fleet_name` VARCHAR(128) NULL,
    `distance_km` DOUBLE DEFAULT 0.0,
    `start_time` TIMESTAMP NOT NULL,
    `end_time` TIMESTAMP NOT NULL,
    `start_address` VARCHAR(255) NULL,
    `end_address` VARCHAR(255) NULL,
    INDEX `idx_trip_imei` (`imei`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Live Stream Sessions (JT/T 1078 & HLS Quota Tracking)
CREATE TABLE IF NOT EXISTS `live_sessions` (
    `session_id` VARCHAR(64) PRIMARY KEY,
    `terminal_id` VARCHAR(32) NOT NULL,
    `channel_id` VARCHAR(16) NOT NULL, 
    `user_id` VARCHAR(64) NULL,
    `start_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `end_time` TIMESTAMP NULL,
    `duration_seconds` INT DEFAULT 0,
    `hls_url` TEXT NULL,
    `status` VARCHAR(24) DEFAULT 'ACTIVE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Initial Seed Data
INSERT IGNORE INTO `tenants` (`id`, `name`, `code`, `contact_email`, `plan`)
VALUES ('ten-001', 'Inurum Global Fleet', 'INURUM_HQ', 'admin@inurum.com', 'INR_500_ANNUAL');

INSERT IGNORE INTO `users` (`id`, `tenant_id`, `email`, `password_hash`, `full_name`, `role`)
VALUES ('usr-001', 'ten-001', 'superadmin@inurum.com', 'admin123', 'Inurum Super Admin', 'SUPER_ADMIN'),
       ('usr-002', 'ten-001', 'driver@inurum.com', 'driver123', 'Suresh Kumar', 'DRIVER');
