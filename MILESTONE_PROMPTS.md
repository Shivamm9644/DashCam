# Follow-up prompts
Use these sequentially after reviewing the preceding milestone evidence.

M0: Audit the supplied protocol folder without changing it. Reproduce baseline packet and real-device behavior. Deliver inventory, capability matrix, unknowns, architecture decisions and revised milestone estimates. Flag missing SD clip/pre-roll/audio capabilities.

M1: Implement foundation, PostgreSQL migrations, tenant model, authentication/authorization and UI shell. Seed three tenants and all roles. Prove cross-tenant API and socket denial. Deliver role screenshots and test results.

M2: Implement required masters, inventory, device claims/assignment transfer, plan versions and subscriptions. Add server validation, pagination, deactivation and audit. Test concurrent assignment and referenced-record deletion.

M3: Integrate existing protocol through adapters. Implement GPS latest/history, trips and map with freshness and invalid-fix states. Replay baseline fixtures and test real-camera GPS without rewriting the working protocol.

M4: Implement event state machine, bounded media jobs, recorded audio and explicit on-demand live start/stop. Gate by confirmed model capability. Test real event footage and codecs, unsupported pre-roll, browser close and server-enforced stream TTL.

M5: Implement atomic quota reservations, ingress/live counters, caps, expiry/cleanup and usage dashboard. Demonstrate simultaneous last-byte reservations, upload storm, object deletion failure, expired subscription and monthly rollover.

M6: Implement tenant-safe reports/exports, basic notifications, geofence/rule UI within agreed scope, responsive polish and PWA. Show customer mobile views and verify private data is never cached for offline access.

M7: Execute TEST_CASES.csv and TEST_STRATEGY.md. Attach actual results and reproduction steps. Run isolated load/soak, real-device pilot and backup restore. Deliver measured costs, supported device matrix, unresolved issues and deployment/rollback runbook. Do not mark ready with open P0/P1 or pretend test fixtures prove real hardware support.
