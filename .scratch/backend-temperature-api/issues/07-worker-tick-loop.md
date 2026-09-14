# 07: Run the worker on a fixed Tick

**What to build:** The process that actually collects data. An operator starts the worker against a seeded database, leaves it alone, and
Coverage climbs: within roughly 26 minutes the temperature endpoint is answering with a full Snapshot instead of an empty one. This is the
first end-to-end demonstration of the system working.

The worker runs on a fixed 60-second Tick, calling the use case from ticket `06` on each one. Sweeps start twice a day, costing about 5,000
upstream calls against a 10,000/day Budget — roughly half the allowance, leaving real headroom. Both the Tick interval and the Slice size
are configuration values.

**Exactly one process makes upstream calls.** The worker is its own process with its own entrypoint, sharing the api's image and codebase
and differing only by entrypoint and script — see ADR-0002. This is deliberate and structural: scaling the api to several replicas must
leave exactly one worker running, because a worker embedded in the api would multiply upstream traffic by the replica count and destroy the
accounting the whole design rests on.

The worker fails fast at boot with the same actionable instructions as the api when the schema is missing or the Grid has not been seeded,
so it can never silently sweep zero Grid Points.

Logging is structured, and every Rate Limit response is logged alongside the Slice that triggered it — the operator's only way to check the
Budget assumptions from ADR-0001 against what the provider actually does.

**Blocked by:** 06

**Status:** ready-for-agent

- [x] The worker starts from the same image and codebase as the api, with a different entrypoint and script, and is a separate process
- [x] It advances the open Sweep once per Tick on a fixed 60-second interval, and both the interval and the Slice size are configuration
- [x] Sweeps start twice a day
- [x] Started against a seeded database, it drives a Sweep to completion and the temperature endpoint's Coverage climbs from zero to full
- [x] Killing the worker mid-Sweep and restarting it resumes from the cursor, replaying at most the interrupted Slice, and does not restart
      the Sweep from the beginning
- [x] It fails fast at boot with an actionable instruction when the schema is missing or the Grid has not been seeded
- [x] Logging is structured, and every Rate Limit response is logged alongside the Slice that triggered it
- [x] The Sweep row's upstream call count and Rate Limit hits can be queried after a real Sweep and compared against the Budget assumption
