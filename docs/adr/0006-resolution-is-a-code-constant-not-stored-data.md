# Resolution is a code constant, not stored data

`0001-fetch-hourly-forecast-windows.md` already established that 5° is a ceiling imposed from outside — the Budget makes 2.5° impossible,
and nothing shy of a materially larger free tier changes that. Despite Resolution being fixed for the foreseeable future,
`resolutionDegrees` was threaded as a parameter through most of the datasource and domain-utils methods that touch a Grid Point, and stored
as a `resolution_degrees` column on every row of `grid_points`, part of its unique index alongside latitude and longitude.

We removed it from both. Every call site now reads `GRID_RESOLUTION_DEGREES` directly from `apps/api/src/core/config.ts`, the
`resolution_degrees` column is dropped by migration, and the unique index is rebuilt on latitude and longitude alone. The wire contract is
unchanged: `SnapshotResponse` still reports `resolutionDegrees`, now sourced from the constant instead of a column value that was identical
on every row anyway.

## Consequences

- A value that cannot vary was being carried by every row, every method signature, and every test fixture as if it could. Removing it is
  pure simplification, not a loss of flexibility Planetinha ever exercised.
- If Resolution ever needs to change per-environment or per-row again, the fix is to reintroduce the column and the parameter at that point
  — not to keep carrying them now against a scenario `0001` already says is unreachable on the current Budget.
