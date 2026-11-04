# Cost and storage policy

## Proposed basic plan, configurable and versioned
INR 500/device/year = INR 41.67/device/month gross before tax, support and fees. Proposed infrastructure target: INR 10-15/device/month at useful scale, not a promise. SIM recharge/data and hardware are separate. A 10-device pilot will need subsidy because fixed server costs dominate.

| Data | Initial default | Enforcement |
|---|---|---|
| GPS | Device moving interval 30s; stopped 300s where supported | Preserve alarms/ignition transitions; server downsampling otherwise |
| GPS history | 90 days detailed | Daily trip summaries 365 days; configurable |
| Event metadata | 365 days | No indefinite raw payload archive |
| Event clip | Target 30s, one channel, target 512 kbps video + 32 kbps audio | Measured caps, not assumed encoder control |
| Event media | 7-day TTL; 250 MB stored/device; 1 GB monthly accepted uploads/device | Whichever cap is first; count retries/ingress separately |
| Live view | 30 device-channel minutes/month, 1 channel, 1 viewer/device | 120s session cap, idle stop, explicit restart, concurrency limits |
| Audio | Embedded event audio under same media allowance | Consent/config toggle; no continuous cloud recording |
| Optional voice files | Disabled basic by default | Explicit feature quota shares media budget, never unlimited |
| Raw protocol diagnostic logs | Redacted 24h default | Size cap and sampling; extended debug opt-in |
| Temporary media | Session lifetime plus cleanup grace | Disk high-water rejection and bounded queues |

These are starting commercial limits, requiring pilot measurements. Notify at 80% and 100%. At cap, keep event metadata and mark MEDIA_NOT_SAVED_QUOTA; do not silently discard evidence or trigger unapproved overage charges. Monthly counters reset in a documented UTC billing window. Retention changes show their effect before destructive cleanup. Pinning is quota-limited and not included in basic; no unlimited legal-hold promise.

## Size calculations (decimal units)
bytes = (video_kbps + audio_kbps) * 1000 * seconds / 8 * channels.
30s at 544 kbps = 2.04 MB/clip. Five clips/day = 10.2 MB/day, 71.4 MB at 7-day rolling retention and 306 MB monthly upload. 1,000 devices at that average hold about 71.4 GB media before overhead. At 20 clips/day, monthly upload is about 1.224 GB and the 1 GB upload quota will trigger. Every cap is needed because event storms can dominate cost.
Continuous 1 Mbps video = 10.8 GB/day/channel, or 324 GB/30 days. Continuous 32 kbps voice = 345.6 MB/day, 10.368 GB/30 days. Thirty live minutes at 544 kbps = 122.4 MB/device/month media transport, excluding overhead; 1,000 devices would relay about 122.4 GB. Base VPS bandwidth and device SIM data still matter even if object storage egress is free.
GPS every 30s for 8 moving hours plus 300s for 16 stopped hours = 1,152 points/day, ~103,680 points/device/90 days. At 1,000 devices ~103.68 million retained rows. Estimate real table/index/WAL/backup bytes from measured inserts; do not size this as only the JSON payload size. Use partitioning, selective indexes, bulk ingest and tested downsampling from the beginning.

## Realistic fixed-cost arithmetic, illustrative INR assumptions, not vendor quotes
Assume app/media VPS 1,500/month + backup/monitoring allowance 300 + database/disk allowance 300 = 2,100/month fixed. Allow variable media/database/requests/network 3/device/month pending measurements.
| Devices | Monthly gross equivalent | Modelled monthly infra | Infra/device | Gross left before other costs |
|---|---:|---:|---:|---:|
| 10 | 416.67 | 2,130 | 213 | -1,713.33 |
| 100 | 4,166.67 | 2,400 | 24 | 1,766.67 |
| 500 | 20,833.33 | 3,600 | 7.2 | 17,233.33 |
| 1,000 | 41,666.67 | 5,100 | 5.1 | 36,566.67 |
This is arithmetic, not a capacity claim that a 1,500 INR VPS can handle 1,000 cameras. If measured resources require a bigger tier, update fixed costs and break-even. Under these assumptions infrastructure-only break-even is ceil(2100/(500/12-3)) = 55 devices; actual business break-even is higher. Use net revenue if tax is included.

## Storage provider reference and cost ledger
Verified 22 Oct 2026: Cloudflare R2 Standard published storage $0.015/GB-month, Class A $4.50/million, Class B $0.36/million, direct egress free. 71.4 GB media is ~$1.071/month in storage alone before billing rounding, requests, tax and any included allowance. Do not infer total SaaS cost from this number. Short retention favors evaluating Standard rather than classes with minimum durations. Verify current terms, deployment region, video delivery suitability and full bill before deployment.
Source: https://developers.cloudflare.com/r2/pricing/

Cost ledger per tenant/device/month: accepted media bytes, attempted ingress bytes, object count/requests, live seconds and relay bytes, GPS points, retained DB bytes estimate, transcode CPU, notification sends, backup share. Alert on unexpected daily growth; cap FFmpeg processes and total concurrent live sessions globally. VPS provider egress, map tiles/geocoding, OTP/email, monitoring and backups are explicit cost lines. Cache/geofence locally; use a tile provider whose usage policy permits the product, not unlimited assumptions about free public tiles.

## Event handling that actually reduces cost
Prefer device alarm-triggered SD clip upload/retrieval. Proposed 10s before + 20s after is ONLY possible if a device buffer or historical SD retrieval supports it. If unsupported, store post-trigger available footage, label actual times, or disable pre-roll. A server buffer would require continuous uplink and undermines the base cost design.
Priority: SOS/collision > tamper > driving events > informational. Merge overlapping windows and deduplicate by device/alarm/time/channel; preserve individual event records and relations. Reserve part of media quota for critical alarms, with no guarantee after all limits are exhausted. Bound prefetch, retries, file size, duration and queue age. Block unsolicited continuous uploads as far upstream as the protocol permits, disconnect abusive devices and record enforcement. Admission control must reserve bytes atomically before ingest and reconcile actual output, with rollback on failure.
Do not upload every 3-second live HLS segment permanently. Use ephemeral live segments and one finalized event file where possible. Avoid always-on transcoding; remux compatible streams, transcode only when required with bounded workers. Unsupported codec must produce an explicit UI state.
