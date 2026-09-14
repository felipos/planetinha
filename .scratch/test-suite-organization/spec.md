# Add integration tests and document the test taxonomy

Status: needs-triage

## Problem Statement

`apps/api/tests/` already splits into `http/` (the real Fastify instance with fake datasources), `integration/` (one Tick through
`AdvanceSweepUseCase` with fake datasources), and `unit/` (the upstream datasource with `fetch` mocked, plus pure domain classes) — but
every one of those seams stops short of a real Postgres. A real migration mistake, a bad join, a constraint violation, or a type mismatch
between Drizzle and Postgres is only caught by hand-testing the running stack today. `apps/web/tests/` has `component/`, `integration/`, and
`unit/` folders but no written-down definition of what belongs in which.

## Solution direction (not yet decided)

Decide what "integration test" means for this project going forward — most likely: a test that runs real SQL against a real, ephemeral
Postgres (via something like `testcontainers`, or a dedicated `compose` test service), rather than the fake-datasource seam the
`integration/` folder currently holds. Add a first slice of such tests for the riskiest queries, then write down the resulting tiers so
future tests land in the right folder without guessing.

## Open questions for triage

- Does "integration test" get redefined to mean "against a real database", leaving the current `apps/api/tests/integration/` tests to be
  re-labeled (e.g. as a fourth, fake-backed tier), or does a real-database tier get a new folder name instead?
- How does a real-database test provision Postgres in CI and locally — `testcontainers`, a dedicated `compose.test.yaml`, or reusing the dev
  stack with a throwaway schema?
- Which queries most need this — `ForecastsDbDataSource`'s pole-aware left join and `GridPointsDbDataSource`'s cursor-ordering are the two
  riskiest candidates today.
- `apps/web` has no datasource that talks to a database at all — does it need a "real" integration tier, or does its `integration/` folder
  already mean the right thing (exercising a use case against a fake datasource, one seam below `component/`)?
