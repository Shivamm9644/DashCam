-- =====================================================================
-- Rollback Script: Undo Migration V2
-- Engine: MySQL 8.0+ / MariaDB 10.5+
-- =====================================================================

USE `dashcam_db`;

-- 1. Drop Fleet Performance & Utilization Aggregates
DROP TABLE IF EXISTS `fleet_utilization_daily`;

-- 2. Drop Cost Controls Table
DROP TABLE IF EXISTS `tenant_cost_controls`;

-- 3. Drop Device-to-Vehicle Uniqueness Constraint if added in V2
ALTER TABLE `vehicles`
    DROP INDEX IF EXISTS `uk_vehicle_terminal_device`;

-- 4. Drop User Vehicle Access Control Table
DROP TABLE IF EXISTS `user_vehicle_permissions`;

-- 5. Remove Added Columns from Tenants Table
ALTER TABLE `tenants`
    DROP COLUMN IF EXISTS `subscription_plan`,
    DROP COLUMN IF EXISTS `subscription_start`,
    DROP COLUMN IF EXISTS `subscription_expiry`,
    DROP COLUMN IF EXISTS `billing_status`,
    DROP COLUMN IF EXISTS `max_vehicles`,
    DROP COLUMN IF EXISTS `monthly_live_minutes_cap`,
    DROP COLUMN IF EXISTS `storage_cap_mb`;
