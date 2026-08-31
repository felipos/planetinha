# Backend temperature API

Status: ready-for-agent

## Problem Statement

Vento fetches whole-planet temperature directly from the browser, and the upstream weather API's free tier cannot sustain it. Every
visitor's browser independently sweeps the entire Grid, so the Budget is multiplied by the number of open tabs, and each sweep fires its
requests fast enough to breach the per-minute Rate Limit. The result is a stream of HTTP 429s and a globe that routinely renders with large
regions missing, with no way to tell whether a gap means "no data exists here" or "we got rate-limited halfway through".

The arithmetic is not marginal. At the current 10° Resolution, one browser refreshing every 30 minutes needs roughly 33,000 weighted calls
per day against a 10,000/day Budget — over three times the allowance before a second tab opens. The failure is structural, not a tuning
problem.

## Solution

Move all upstream fetching behind a backend that Vento owns. A single worker process collects Forecasts on a paced schedule and stores them
in Postgres; the browser asks that backend for a Snapshot and never contacts the weather provider at all.

Because the worker fetches an hourly Forecast window rather than an instantaneous value, one Sweep yields two days of Forecasts per Grid
Point. Freshness stops depending on how often we sweep, which is what collapses the required Budget from over 300% of the allowance to
roughly 50% — while simultaneously allowing a four-times-finer Grid than today.

For the viewer, the globe stops being partially empty for reasons they cannot see, gains Coverage they can read, and shows temperature at 5°
instead of 10° Resolution.

## User Stories

1. As a globe viewer, I want the globe to show temperature for the whole Earth, so that I am not looking at gaps caused by our own
   infrastructure.
2. As a globe viewer, I want the globe to load in a couple of seconds, so that I am not waiting on dozens of sequential upstream requests.
3. As a globe viewer, I want a Cell with no temperature to be visibly distinct from a cold Cell, so that I never mistake No Data for a real
   reading.
4. As a globe viewer, I want temperature sampled every 5° instead of every 10°, so that continental features are discernible.
5. As a globe viewer, I want each Cell to show exactly the Forecast that was fetched for its Grid Point, so that I am never shown a blended
   value the system invented.
6. As a globe viewer, I want to click anywhere on the globe and see the containing Cell's real coordinates and Forecast, so that I know
   which Grid Point the number belongs to.
7. As a globe viewer, I want to be told what percentage of the Grid currently has data, so that a sparse globe is explained rather than
   mysterious.
8. As a globe viewer visiting a freshly deployed instance, I want a clear "initial data load, N% complete" message, so that an empty globe
   does not look like a broken one.
9. As a globe viewer, I want the globe to keep showing the last good data when the backend becomes briefly unreachable, so that a transient
   blip does not blank my screen.
10. As a globe viewer, I want the globe to pick up a new hour's Forecasts within a few minutes, so that the display does not lag reality by
    half an hour.
11. As a globe viewer, I want Coverage to visibly climb while the first Sweep runs, so that I can see the system working rather than guess.
12. As a globe viewer, I want the poles rendered like every other part of the globe, so that there is no permanent hole at the top and
    bottom.
13. As an operator, I want exactly one process making upstream calls, so that the Budget is spent by a single accountable party.
14. As an operator, I want scaling the API to several replicas to leave exactly one worker running, so that horizontal scaling cannot
    multiply upstream traffic.
15. As an operator, I want each Sweep to record how many upstream calls it made and how many Rate Limit responses it received, so that I can
    verify our assumptions about upstream call weighting against reality.
16. As an operator, I want a Sweep to be resumable after a process restart, so that a deploy in the middle of a Sweep does not waste the
    calls already spent.
17. As an operator, I want a Sweep to advance in Slices on a fixed Tick, so that upstream traffic is paced by construction rather than by
    whatever speed the network happens to allow.
18. As an operator, I want Sweeps to run twice a day, so that Forecasts are corrected regularly while staying near half the daily Budget.
19. As an operator, I want a health endpoint that does not touch the full Snapshot, so that container health checks are cheap enough to run
    every few seconds.
20. As an operator, I want the API and the worker to run from the same image with different entrypoints, so that there is one build artifact
    to reason about.
21. As an operator, I want the whole stack to come up with a single compose command, so that onboarding does not require a runbook.
22. As an operator, I want the database to fail fast with an actionable message when the schema is missing, so that a forgotten migration
    produces an instruction rather than a stack trace.
23. As an operator, I want the same fail-fast treatment when the Grid has not been seeded, so that the worker does not silently sweep zero
    Grid Points.
24. As an operator, I want the Grid's Grid Points enumerated in a table I can query, so that I can inspect what we sample rather than infer
    it from a loop.
25. As an operator, I want each Grid Point to record the Resolution it belongs to, so that reseeding at a different Resolution cannot
    silently produce a Snapshot mixing two lattices.
26. As an operator, I want an interrupted Slice to be safe to re-run, so that crash recovery needs no special reasoning.
27. As an operator, I want migrations run explicitly by a human or an agent, so that no process migrates the database as a side effect of
    starting.
28. As an operator, I want the migration and seed procedure documented, so that the manual steps are discoverable without reading source.
29. As a developer, I want the frontend to know nothing about any weather provider, so that the provider can be replaced without touching
    presentation code.
30. As a developer, I want the frontend to call the same relative API path in development and production, so that there is no
    environment-specific base URL and no CORS configuration.
31. As a developer, I want to run the frontend on my host against the containerised API, so that hot module reloading still works.
32. As a developer, I want the backend to use the same layering, dependency injection, and naming conventions as the frontend, so that there
    is one architecture to learn.
33. As a developer, I want backend tests to run with no database and no network, so that the test loop stays fast.
34. As a developer, I want the API contract exercised through the real route rather than through internal functions, so that a serialization
    or schema mistake fails a test.
35. As a developer, I want the upstream response mapping covered by its own tests, so that a change in the provider's payload shape is
    caught locally.
36. As a developer, I want the wire contract expressed in the domain's vocabulary, so that reading a response teaches the domain rather than
    obscuring it.
37. As an agent working in this repo, I want a Snapshot's meaning to be unambiguous, so that I do not assume it is the output of a single
    Sweep.
38. As an agent working in this repo, I want each Forecast to carry its own Fetched At, so that I do not have to assume every value in a
    Snapshot was retrieved at the same moment.

## Implementation Decisions

### Grid and Resolution

- Resolution is 5°, giving 37 latitude rows and 72 longitude columns.
- The two poles are stored **once** each rather than 72 times, because all 72 longitudes at a pole name the same physical location. The Grid
  therefore holds **2,522** Grid Points, not 2,664 — saving 142 upstream calls per Sweep.
- The Grid is materialised by an explicit seed command into a Grid Point table with latitude, longitude, and the Resolution it belongs to.
  Nothing recomputes Grid Points at runtime; the table is the source of truth.
- The Resolution column exists so that a future reseed at a different Resolution cannot produce a Snapshot silently mixing two lattices.

### What the worker fetches

- Each upstream request asks for an hourly temperature series covering two forecast days, for up to 100 Grid Points at once. See ADR-0001
  for the Budget arithmetic behind this.
- One Sweep therefore yields 48 hourly Forecasts per Grid Point.
- Sweeps run twice a day, costing about 5,000 upstream calls against a 10,000/day Budget.
- Values are model output. They are Forecasts, never readings or observations — this holds for the present hour as much as for future ones.

### Sweep pacing

- The worker runs on a fixed 60-second Tick. On each Tick it either advances the open Sweep by one Slice of 100 Grid Points, or starts a
  Sweep if one is due, or does nothing.
- 2,522 Grid Points is 26 Slices, so a Sweep completes in roughly 26 minutes at about 100 calls/minute — comfortably under the per-minute
  Rate Limit, with the daily Budget as the actual binding constraint.
- Slice size and Tick interval are configuration values, so pacing can be tuned against measured Rate Limit responses.

### Sweep state and failure handling

- One row per Sweep, not one mutable row, so the history of call counts and Rate Limit hits survives.
- A Sweep row records: start time, completion time, status (in progress / completed / failed / abandoned), the cursor identifying the last
  Grid Point committed, total and fetched and failed Grid Point counts, upstream calls made, Rate Limit hits, last error, and last Slice
  time.
- The cursor advances only after a Slice commits, so a crash mid-Slice replays that Slice on restart. Combined with idempotent upsert, this
  needs no special recovery logic.
- A failing Slice is logged and skipped; the Sweep continues. There is no retry policy and no abandonment policy in this release — see Out
  of Scope.

### Storage

- Forecasts are keyed by (Grid Point, Valid At) and written with an idempotent upsert, so a later Sweep's fresher Forecast overwrites an
  overlapping hour and a replayed Slice is harmless.
- Each Forecast row carries its own Fetched At.
- Temperature is nullable. Null means No Data and must never be conflated with zero.
- An index on Valid At is required from the start: the read path filters by a single hour and the table grows without bound in this release.
- Growth is roughly 60,500 new rows/day. Nothing deletes anything yet — see Out of Scope.

### API contract

One resource endpoint plus a health endpoint. The response shape is a genuine contract with the frontend, so it is stated precisely:

```
{
  "validAt": "<ISO hour the Forecasts describe>",
  "resolutionDegrees": 5,
  "coverage": { "total": 2664, "withData": 2612 },
  "sweep": { "status": "in_progress", "completedAt": null },
  "forecasts": [
    { "latitude": 90, "longitude": 35, "temperatureCelsius": -31.4, "fetchedAt": "<ISO instant>" }
  ]
}
```

- The endpoint always returns **every** Grid Point of the expanded Grid, using null for No Data. It never omits points.
- `coverage.total` is **2,664**, not 2,522: the API expands each stored pole Grid Point back across all 72 longitudes so the wire format
  describes a uniform lattice. Pole dedup is a Budget optimisation and must not be visible to the frontend.
- There is no top-level Fetched At. A Snapshot is assembled per hour from whatever Forecasts exist and may contain rows written by different
  Sweeps, so a single response-level fetch time would be a lie. Fetched At is per Forecast.
- Valid At is selected by flooring to the current hour, falling back to the most recent hour that has data.
- Before the first Sweep completes, the endpoint returns success with every temperature null and `coverage.withData` at zero. An empty Grid
  is the limiting case of partial Coverage, not a distinct error.
- A missing schema or unseeded Grid is a different failure, caught by fail-fast at boot; the API never serves in that state.
- No caching headers in this release.

### Backend architecture

- Fastify, Postgres, Drizzle. Layering, ports, injection tokens, and file-role naming suffixes follow the existing frontend conventions.
- Dependency injection uses the same container as the frontend, which requires decorator metadata emission. This rules out both Node's
  native type stripping and esbuild-based loaders; see ADR-0004, which records the failure mode precisely because it manifests at runtime
  rather than at build time.
- The test runner is Node's built-in test runner.
- The API and the worker share one image and one codebase, differing only by entrypoint and npm script. See ADR-0002.

### Frontend changes

- The existing data source port stays; only its implementation changes, to one that calls Vento's own API.
- The upstream provider adapter and the mock adapter are both deleted. The frontend gains no fallback path to the weather provider —
  deliberately, since a client-side fallback fires on every client simultaneously at exactly the wrong moment. See ADR-0002.
- Interpolation is removed. Each Cell renders its own Grid Point's Forecast as a flat block, producing a visibly blocky globe. This is
  intended, not unfinished; see ADR-0003.
- Clicking the globe reports the containing Cell's Grid Point and its real coordinates. The "is this value interpolated?" flag ceases to
  exist because the question cannot arise.
- The interpolator shrinks to a Cell locator: coordinate rounding, longitude wrapping, key lookup.
- Resolution is read from the response rather than hardcoded, so the backend owns it.
- The refresh interval drops from 30 minutes to 5, since the constraint that justified 30 (upstream Budget) no longer applies to a call
  against our own API.
- The frontend calls a relative API path in both environments — proxied by the dev server locally, by the reverse proxy in production. No
  API base URL variable and no CORS configuration exist.

### Infrastructure

- Compose runs Postgres, the API, the worker, and a reverse proxy serving the built frontend. The dev frontend is not containerised.
- Migrations and seeding are run manually from the host against the published database port. Both the API and the worker fail fast at boot
  with an actionable instruction when the schema or the Grid seed is missing.
- The database connection string necessarily has two values — one for host tooling, one for containers — kept in separate places so neither
  context can read the other's.
- API and worker images use a glibc-based Node base image, because the TypeScript loader ships native binaries and a musl mismatch is
  expensive to diagnose inside a container. The proxy image has no native dependencies.
- Structured logging in both processes, with every Rate Limit response logged alongside the Slice that triggered it.

## Testing Decisions

A good test here asserts external behaviour through the highest available seam and says nothing about internal structure. Tests should read
as statements about the domain — what a Snapshot contains, what happens to the cursor after a Slice — not about which class called which
method. Three seams, confirmed with the developer:

### S1 — HTTP, through the real route

The read path is tested by injecting requests into the API instance in-process, backed by a fake repository. This is the highest seam
available and covers the entire contract the frontend depends on: pole expansion across 72 longitudes, Coverage counting, null for No Data,
Valid At selection and its fallback, per-Forecast Fetched At, the sweep block, and response serialization. No database, no network.

Cases include: a fully covered Snapshot; a partially covered one; a completely empty one before the first Sweep; an hour with no rows
falling back to the most recent hour that has data; and both poles appearing at every longitude.

### S2 — One Sweep Tick, through the sweep use case

The write path cannot reach S1 because the worker has no HTTP surface, so the use case is the highest seam. Driven with a fake
forecast-source port and a fake repository.

Cases include: a Tick advancing the cursor by exactly one Slice; a Tick starting a Sweep when one is due; a Tick doing nothing when none is;
a replayed Slice producing no duplicate Forecasts; a failing Slice being skipped without halting the Sweep; and Sweep counters being
updated. The 60-second timer itself is deliberately not tested — the loop is trivial and fake timers would add noise without adding
confidence.

### S3 — Upstream response mapping, with HTTP mocked

S2's fake port leaves the provider's payload shape untested, so the adapter gets its own tests with the HTTP client mocked. Cases include:
hourly arrays aligned positionally to comma-separated coordinates; null temperatures in the series; provider error bodies; and a Slice of
100 Grid Points mapping to the right Grid Points.

Prior art for this pattern already exists in the frontend's upstream adapter test, which this release deletes; that knowledge moves here.

### Frontend

No new seams. The existing component tests (rendering with a fake use case) and the existing use-case integration test (wired to a fake
port) cover the data source swap and the interpolation removal. Tests for the removed interpolation routine are deleted; tests for the
surviving coordinate helpers stay.

### Conventions

Arrange / Act / Assert with the three phases explicitly separated, one action under test per case, and shared fixtures in a fixtures
directory with the established suffix. Test names use the glossary's vocabulary.

## Out of Scope

- **A shared contracts package.** The two packages duplicate the wire types by hand, with a validator on the consuming side. Revisit if
  drift becomes a real problem.
- **Response caching and ETags.** Deliberately deferred to keep the first release simple.
- **The time axis.** The database accumulates 48 hourly Forecasts per Grid Point, but the endpoint serves only the current hour. Query
  parameters for selecting an hour or a range, and any temporal animation, are future work that this design deliberately does not foreclose.
- **Retention pruning.** Seven days was decided as the retention policy but nothing enforces it in this release. It belongs to a separate
  scheduled worker, explicitly not the sweep worker's responsibility. Its first run will clear a large backlog.
- **Sweep retry and abandonment policy.** A failing Slice is skipped; a Sweep that overruns its successor is not abandoned.
- **Backend mocks and seeded sample data.** With the frontend mock adapter deleted, a fresh checkout shows an empty globe filling in over
  roughly 26 minutes. Any future mock belongs on the backend.
- **Database-backed tests.** No containerised database in the test loop.
- **Resolutions finer than 5°.** 2.5° needs 10,512 Grid Points, exceeding the entire daily Budget for a single Sweep. This is a ceiling
  imposed from outside and cannot be engineered around on the current tier.
- **Automated migrations.** No process migrates as a side effect of starting.
- **Containerised dev frontend.** Run it on the host against the containerised API.
- **Isolating developers from the shared Budget.** Every compose start runs the worker, so several developers running the stack
  simultaneously compete for one allowance. Accepted for now.
- **Pinning the frontend's dependency versions.** The repo's conventions require exact pins and most frontend dependencies still use ranges.
  New backend dependencies are pinned; the existing ones are untouched.

## Further Notes

**The upstream provider has no pagination.** There is no cursor, page, or continuation token. The only axis for splitting a request is the
number of Grid Points per call. The resumable Sweep state in this spec is Vento's own slicing, not the provider's.

**Upstream call weighting is not fully documented.** The provider states that cost depends on the number of locations requested but
publishes no formula. The Budget arithmetic here assumes roughly one call per Grid Point. This assumption is why every Sweep records its
call count and Rate Limit hits — so it can be checked against reality rather than trusted. If it proves harsher, Resolution or Sweep
frequency must come down; if more generous, there is room to raise one of them.

**Repository restructuring is already complete.** The frontend has been moved into a workspace and the monorepo tooling is in place, with
build, lint, and tests passing. This spec covers the work that follows.

**Suggested landing order**, agreed with the developer: schema, migrations and seed; then the API; then the worker; then pointing the
frontend at the API; then removing interpolation; then compose, the proxy and documentation. The last two frontend changes are separated
deliberately so a rendering regression can be bisected apart from a data source swap.
