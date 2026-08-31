# 06: Advance a Sweep by one Slice

**What to build:** One Tick's worth of work, as a use case that can be called directly. Given the current state of the world it either
starts a Sweep because one is due, advances the open Sweep by exactly one Slice, or does nothing at all. Calling it repeatedly walks a Sweep
from start to completion.

This is what converts the Budget into a safe pace. A Slice is 100 Grid Points, so the Grid's 2,522 Grid Points are 26 Slices, and a Sweep
completes in roughly 26 minutes at about 100 calls per minute — comfortably under the Rate Limit, with the daily Budget as the actual
binding constraint. Slice size is configuration, not a constant, so pacing can be tuned against measured Rate Limit responses.

Resumability is the point of the cursor. It advances **only after a Slice commits**, so a crash or a deploy mid-Slice replays that Slice on
restart rather than losing it. Combined with the idempotent upsert keyed by (Grid Point, Valid At), that replay is harmless and needs no
special recovery logic — and a later Sweep's fresher Forecast simply overwrites an overlapping hour.

Failure handling in this release is deliberately minimal: a failing Slice is logged and skipped, and the Sweep continues. There is no retry
policy and no abandonment policy — a Sweep that overruns its successor is not abandoned. That is out of scope, not forgotten.

Each Sweep records how many upstream calls it made and how many Rate Limit responses it received, because the assumption that a call costs
roughly one per Grid Point is **not documented by the provider**. These counters exist so the assumption can be checked against reality
rather than trusted; if it proves harsher, Resolution or Sweep frequency must come down.

Tested at the use-case seam — the write path has no HTTP surface, so this is the highest seam available — driven with a fake forecast source
and a fake repository. The 60-second timer is deliberately not tested here; it belongs to ticket `07`, and fake timers would add noise
without adding confidence.

**Blocked by:** 03, 05

**Status:** ready-for-agent

- [ ] A Tick with an open Sweep advances the cursor by exactly one Slice and writes that Slice's Forecasts
- [ ] A Tick with no open Sweep and one due starts a Sweep, recording its start time and its total Grid Point count
- [ ] A Tick with no open Sweep and none due does nothing
- [ ] Replaying a Slice produces no duplicate Forecasts, and a fresher Forecast for an hour already stored overwrites it
- [ ] A Slice whose upstream call fails is logged and skipped, the failed count is updated, and the Sweep continues to the next Slice
- [ ] The cursor does not advance for a Slice that did not commit
- [ ] Upstream calls made and Rate Limit hits are accumulated on the Sweep row
- [ ] Slice size is configuration rather than a hardcoded constant
- [ ] Every case is driven through the use case with a fake forecast source and a fake repository — no database, no network
