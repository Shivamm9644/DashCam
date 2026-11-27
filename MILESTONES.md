# Milestones and acceptance gates
Estimates assume one experienced full-stack developer with agent assistance, stable working protocols and prompt hardware access. Total core implementation estimate 35-49 working days, not a deadline guarantee. Re-estimate after M0. Hardware/protocol missing features and vendor dependencies are separate. Never mark a milestone done from screenshots alone.

| Milestone | Days | Deliverables | Acceptance |
|---|---:|---|---|
| M0 Audit and freeze | 2-3 | Read supplied source, baseline fixtures, capability matrix, risk register, architecture decisions | Working protocol baseline reproduced; all unknown device capabilities listed; no source rewrite |
| M1 Foundation and design | 4-5 | Repo, staging config, schema/migrations, auth, tenant/roles, navigation, UI components | Tenant isolation and login tests pass; three role home screens with real states |
| M2 Masters and provisioning | 4-5 | All core masters, inventory, assignments, subscription plan versions, import validation | Reference-safe CRUD, cross-tenant denial, transfer history and activation tests pass |
| M3 GPS and trips | 4-6 | Gateway adapter, ingest, map/history, trips, stale/offline indicators | Real camera GPS and replay fixtures work; duplicates/clock skew/missing points handled |
| M4 Events, video and voice | 7-10 | Event normalization, clip pipeline, recorded audio, on-demand live, retries and capability states | Real device live start/stop plus event clip/audio tested; unsupported features honest; no continuous cloud recording |
| M5 Quotas and retention | 4-5 | Atomic usage, caps, expiry cleanup, billing states, cost dashboard | Concurrent quota test, storm test, TTL/object deletion and expired-plan enforcement pass |
| M6 Reports and polish | 3-4 | Fleet/trip/event/usage reports, exports, alerts, responsive PWA | Export authorization and large-report limits pass; core screens usable at desktop and 360px |
| M7 Release qualification | 5-7 | Integration/E2E/security/load/soak, backup restore, runbook, pilot and rollback | No open P0/P1; measured cost/capacity; 72h pilot evidence; backup restore meets measured objective |

M2 minimum masters include branches, groups, vehicles, drivers, users/roles, models/capabilities, device inventory/assignment, plans/policies and license allocation. Geofence/rule UI can be delivered in M6 if dependency management and permissions exist earlier. Add a separate 2-4 day task if sophisticated polygon rules are required.

Optional M8 Windows packaging 3-5 days: choose thin Tauri/Electron shell only after PWA validation; installer signing/update policy, permissions and playback checks. This does not make the backend work offline. Optional M9 Flutter mobile 10-15 days after stable versioned API: login, assigned map, events, playback, notifications; no protocol code running inside the app. App store lead time excluded.

For every milestone produce: change summary, migration/rollback notes, test command and actual result, screenshots when relevant, known gaps, measured resource/cost effect and next step. Fix failures in that milestone before proceeding. Critical missing capability is a blocker or explicit scope decision, never a simulated success.
