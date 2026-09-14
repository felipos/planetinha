# 01: Rename the frontend's temperature vocabulary to the glossary

**What to build:** No user-visible change. The frontend's domain types and their fields are renamed to the vocabulary in `CONTEXT.md`, so
that every later ticket in this effort reads in the same language as the wire contract it is about to consume: a Forecast is a Forecast, the
hour it describes is Valid At, and the whole-Grid set of values for one hour is a Snapshot.

This is a prefactor, deliberately landed before the data source swap so that ticket `08` is a change of behaviour and nothing else. It is
not requested by the spec; it exists to make the change that follows easy.

The rename covers the temperature value type and its hour field, the aggregate type holding a whole hour's values, and every consumer of
them — validator, Cell lookup, heatmap texture, hooks, components, and their tests. The current aggregate's "how many points should exist"
field keeps its meaning for now; it becomes Coverage in ticket `09`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The temperature value type is named for a Forecast, and the hour it describes is named Valid At — the glossary's avoided terms
      (reading, observation, measurement, sample, `observedAt`, timestamp) appear nowhere in `apps/web`
- [x] The aggregate holding every value for one hour is named for a Snapshot, not a grid — "Grid" is left to mean positions only
- [x] Test names and fixture names use the same vocabulary
- [x] Build, lint, and the full test suite pass with no behavioural change: the globe renders exactly as it did before
