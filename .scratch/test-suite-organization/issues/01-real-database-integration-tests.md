# 01: Real-database integration tests and a documented test taxonomy

**What to build:** A real-database integration-test seam for `apps/api` — tests that run actual SQL against an ephemeral Postgres rather
than a fake datasource — starting with the two riskiest queries, plus documentation in `docs/architecture.md` naming every test tier this
project has and what belongs in each, so the next test lands in the right folder without guessing.

**Status:** needs-triage — the provisioning approach and the naming of the resulting tiers need a decision before this is ready to
implement.

- [ ] A decision is recorded on how a real-database test provisions Postgres (e.g. `testcontainers` vs. a dedicated compose service vs.
      something else)
- [ ] `ForecastsDbDataSource`'s left join (pole-aware, keeps Grid Points with No Data) has a test against a real Postgres instance
- [ ] `GridPointsDbDataSource`'s cursor ordering (`findSliceAfter`) has a test against a real Postgres instance, confirming the same cursor
      yields the same next Slice across a restart
- [ ] `docs/architecture.md`'s Testing section is updated to name every tier this project now has (unit / fake-backed / real-database, or
      whatever naming the triage settles on) and which kind of test belongs in each
- [ ] `apps/web`'s existing `unit/` / `integration/` / `component/` split is either confirmed correct as-is or updated to match the same
      documented taxonomy
