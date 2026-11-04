# Product scope

## Goal and boundaries
A minimal, reliable, multi-tenant dashcam SaaS for Super Admin, Admin and Customer. Desktop first, responsive on phones, API ready for a later Flutter app. Store GPS, events and quota-limited event video with recorded audio when the camera supports it. Do not promise continuous cloud video or continuous cloud voice at INR 500/year. Hardware SD card holds continuous footage, subject to actual hardware capabilities.

Phase 1 includes onboarding, login, roles, masters, device assignment, GPS tracking/history, trips, event inbox, authorized live view, event playback/download, quotas, subscription expiry, basic reporting, monitoring and backup. Exclude AI video analysis, facial recognition, paid SMS/WhatsApp, automatic payment gateway, two-way talk, transcription and native mobile apps from the base MVP.

## Role and tenant model
Super Admin is Inurum's platform operator. Admin is one company/fleet tenant. Customer is an account inside that tenant with access only to explicitly assigned devices/vehicle groups. Individual retail buyers can receive their own tenant plus Customer account; do not put unrelated buyers in a shared tenant by default. Reseller hierarchy can be added later without overloading this model.

| Capability | Super Admin | Admin | Customer |
|---|---|---|---|
| Create/suspend tenants and plan versions | Yes | No | No |
| Manage tenant users and vehicles | Explicit support permission | Own tenant | No |
| Inventory/provision device | Platform inventory | Assign claimed inventory in own tenant | No |
| View GPS/events/live | Audited support access with reason | Own tenant devices | Assigned devices |
| Change global safety/cost caps | Yes | No | No |
| Change event settings | Policy ceiling | Within ceiling | Optional delegated subset |
| See usage and renewal | Platform totals | Own tenant | Own allowed devices |
| Download evidence | Explicit audited permission | Own tenant | Assigned devices if allowed |
| Delete evidence | Controlled audited policy | Optional tenant permission | No by default |

Authentication is not authorization. Enforce tenant and assignment checks on APIs, jobs, sockets, reports, exports, media links and command dispatch. Platform support access must be time-bounded and audited, not a silent universal tenant bypass.

## Navigation and screens
Shared: login, password reset, profile, session list, help, notification center.
Super Admin: overview, tenants, device inventory, models/protocol profiles, plans, subscriptions, usage/cost, system health, audit, global settings.
Admin: overview, live map, vehicles/devices, trips/history, events, live view, reports, users/roles, masters, subscription/usage, settings.
Customer: my vehicles, map, route history, events, live/playback, usage/renewal and profile.

Dashboard: online/offline count, last-seen freshness, open critical events, storage and remaining live minutes. Map and list share selection. Device detail has overview/history/events/live/health tabs. Events support type/date/severity/device filters, thumbnail, GPS/time, audio indicator, processing state and expiry. Never auto-open all live feeds. Playback shows video time and GPS time separately if synchronization is uncertain.

## UI direction
Desktop target 1366x768 and 1440x900; mobile baseline 360px. Neutral background, white cards, one restrained accent, 8px spacing system, readable tables, 14-16px body text. Sidebar, page title, filters, compact status badges and consistent buttons. Use a small component system rather than one-off page styling. Include loading, empty, partial-data, offline, expired, denied, unsupported and failed states. Status cannot rely only on color. Keyboard navigation, visible focus, labelled controls, accessible contrast. No fake metrics in production. Demo data must be labelled.

## Master inventory
Every editable master needs validation, search, pagination, create/edit/detail, permissions, active/inactive, audit and reference-safe deletion. Default to deactivation when referenced. Use unique keys scoped appropriately and effective-dated plan/policy versions.

Platform masters: tenant/company; subscription plan/version; feature entitlement; retention/quota policy; device manufacturer/model; protocol profile; supported command/capability profile; firmware catalog (metadata only initially); event types/severity; notification template; currency/timezone reference; global cost ceilings.
Tenant masters: branch; vehicle group; vehicle; driver/contact; device assignment history; camera channel; user; permission role; geofence; overspeed/ignition/alert rule; notification preference; customer-device access; subscription/license allocation.
Country/timezone/currency lists are controlled reference data, not arbitrary free-form CRUD. Do not let users edit wire protocol IDs or create executable codec settings. Geofence and advanced alert UI may follow the core tracking release, but schema and permissions must be planned.

## Product decisions before release
Confirm: INR 500 per device/year or account/year; initial device count and concurrency; channel count; measured bitrate/codecs; GPS reporting intervals; SD-card event recording/retrieval; event upload initiation; device authentication; recorded microphone availability; standalone voice versus video audio; hosting region; customer export/deletion commitments; Windows executable necessity.
Use proposed defaults for prototypes, but mark unsupported hardware features and do not sell them until verified. Alerts are best effort, not an emergency response service.
