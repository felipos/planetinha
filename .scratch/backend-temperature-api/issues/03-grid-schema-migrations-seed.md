# 03: Materialise the Grid — schema, migrations, and seed

**What to build:** The database an operator can inspect. After running the migration and the seed command, the Grid exists as rows they can
query rather than a lattice they have to infer from a loop, and the api refuses to start with an actionable instruction if either step was
forgotten.

The schema covers all three tables this effort needs, so there is one migration to reason about rather than three arriving separately:

- **Grid Points** — latitude, longitude, and the Resolution they belong to. The Resolution column exists so that a future reseed at a
  different Resolution cannot silently produce a Snapshot mixing two lattices.
- **Forecasts** — keyed by (Grid Point, Valid At), each carrying its own Fetched At, with a nullable temperature where null means No Data
  and never zero. An index on Valid At is required from the start: the read path filters by a single hour and the table grows without bound
  in this release.
- **Sweeps** — one row per Sweep rather than one mutable row, so the history of call counts and Rate Limit hits survives. A row records
  start time, completion time, status, the cursor identifying the last Grid Point committed, total/fetched/failed Grid Point counts,
  upstream calls made, Rate Limit hits, last error, and last Slice time.

The seed command materialises the Grid at 5° Resolution: 37 latitude rows and 72 longitude columns, with each pole stored **once** rather
than 72 times, because all 72 longitudes at a pole name the same physical location. That is **2,522** Grid Points, not 2,664 — the dedup
saves 142 upstream calls per Sweep and is a Budget optimisation only, never visible on the wire. Nothing recomputes Grid Points at runtime;
the table is the source of truth.

Migrations and the seed are run explicitly by a human or an agent, from the host against the published database port. No process migrates
the database as a side effect of starting. The connection string necessarily has two values — one for host tooling, one for containers —
kept in separate places so neither context can read the other's.

Because tickets `04` through `07` cannot be exercised without a running database, this ticket also brings up a Postgres service under
compose. The rest of the stack joins it in ticket `11`.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] A migration creates the Grid Point, Forecast, and Sweep tables, including the index on Valid At, and is run explicitly — no process
      migrates on boot
- [x] The seed command populates exactly 2,522 Grid Points at 5° Resolution, each pole appearing once, each row recording its Resolution
- [x] Re-running the seed is safe and does not duplicate Grid Points
- [x] The Grid enumeration is covered by a test that needs no database: point count, poles present exactly once, Resolution recorded
- [x] The api fails fast at boot with an actionable instruction naming the missing step when the schema is absent
- [x] The api fails fast at boot with an actionable instruction when the Grid has not been seeded, rather than starting and serving in that
      state
- [x] A single compose command brings up Postgres, and the migration and seed run against it from the host
- [x] The host connection string and the container connection string live in separate places, neither readable from the other's context
