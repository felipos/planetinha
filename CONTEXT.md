# Planetinha

Planetinha visualises the temperature of the entire Earth on an interactive globe. Its defining constraint is that the upstream weather
API's free tier allows far fewer calls per day than a naive whole-planet refresh needs, so the system is organised around spending that
allowance deliberately rather than around fetching quickly.

## Language

### The lattice

**Grid Point**: One latitude/longitude pair that Planetinha samples temperature at. The set of them is fixed and enumerated in the database,
never derived at runtime. _Avoid_: location, station, coordinate, site

**Grid**: The complete set of Grid Points — a regular lattice covering the whole Earth, with each pole present exactly once. The Grid is
positions; a Snapshot is values. _Avoid_: mesh, point set, coverage map, snapshot

**Resolution**: The spacing in degrees between adjacent Grid Points. Bounded by Budget, not by rendering concerns. _Avoid_: precision,
granularity, density

**Cell**: The square region of the globe's surface that a single Grid Point's temperature colours. Planetinha never blends between Cells: a
Cell shows its own Grid Point's value, or nothing. _Avoid_: tile, patch, pixel

### Temperature values

**Forecast**: A temperature value for one Grid Point at one Valid At hour, produced by the upstream weather model. Not a measurement — no
instrument observed it, and this holds for the present hour just as much as for future ones. _Avoid_: reading, observation, measurement,
sample

**Snapshot**: Every Forecast for a single Valid At hour, across the whole Grid. A Snapshot is _not_ the output of a Sweep: it is assembled
per hour from whatever Forecasts exist, and several different Sweeps may have written them. _Avoid_: grid, frame, dataset, payload

**Valid At**: The hour a temperature value describes. _Avoid_: observedAt, timestamp, time, when

**Fetched At**: The moment Planetinha retrieved a value from the upstream API. Independent of Valid At — one Fetched At yields many Valid At
hours. _Avoid_: updatedAt, syncedAt, retrievedAt

**No Data**: The absence of a temperature for a Grid Point, always represented as `null` and never as `0`. A real temperature of zero and an
absent temperature are different facts. _Avoid_: missing, empty, unknown, unavailable

**Coverage**: For one hour, how many Grid Points have a temperature out of the total. A property of that hour alone — Coverage may differ
between two hours of the same day.

### Collecting

**Sweep**: One complete pass over every Grid Point, collecting temperatures from the upstream API. A Sweep has a start, a cursor, and an
end, and survives a process restart. _Avoid_: run, sync, cycle, job, refresh, update

**Slice**: The contiguous run of Grid Points a Sweep advances through on a single Tick. A Slice is identified by its position in the Sweep's
ordering, and that ordering is what makes a Sweep resumable. _Avoid_: batch, chunk, page, window

**Tick**: The worker's fixed heartbeat. On each Tick the worker either advances the open Sweep or does nothing. Ticks are what convert the
Budget into a safe pace. _Avoid_: interval, poll, beat, schedule

**Budget**: The upstream API's _daily_ call allowance. The binding constraint on Resolution and on how often a Sweep may start. _Avoid_:
quota, limit

**Rate Limit**: The upstream API's _per-minute_ ceiling, which is a separate and far looser constraint than Budget. Exceeding it yields
HTTP 429. _Avoid_: throttle, cap
