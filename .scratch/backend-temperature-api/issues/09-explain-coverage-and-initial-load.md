# 09: Explain Coverage and the initial data load

**What to build:** A sparse globe stops being mysterious. The viewer is told what percentage of the Grid currently has data, and on a
freshly deployed instance they get a clear "initial data load, N% complete" message instead of an empty globe that looks broken — with the
number visibly climbing while the first Sweep runs, so they can see the system working rather than guess.

Coverage now comes from the response's own Coverage counts rather than being inferred from how many values happened to arrive. The response
also says whether a Sweep is in progress and whether one has ever completed, which is what separates "the system is still filling in" from
"this hour genuinely has gaps". Those are different messages and should read differently.

The existing state model already keeps the last good Snapshot visible when a refresh fails instead of blanking the screen; confirm that
still holds against the new backend, so a transient blip degrades to a stale-data notice rather than an empty globe. With a 5-minute
refresh, a new hour's Forecasts appear within a few minutes rather than lagging reality by half an hour.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] The viewer is told what percentage of the Grid has data for the hour being shown, taken from the response's Coverage counts
- [ ] On an instance whose first Sweep has not completed, the message reads as an initial data load with its percentage, not as a failure or
      a partial-coverage warning
- [ ] That percentage climbs across refreshes while the first Sweep runs
- [ ] Once a Sweep has completed, a full Snapshot shows no Coverage message at all
- [ ] A backend that becomes briefly unreachable leaves the last good Snapshot on screen with a stale-data notice, never a blank globe
- [ ] Each distinct state is covered by a component test rendering with a fake use case
