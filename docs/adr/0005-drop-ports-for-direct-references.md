# Drop ports/adapters for direct concrete-class references

Both packages used to be layered as Clean Architecture / Ports & Adapters: an `application/ports/*.port.ts` interface for every seam a use
case crossed, a `tokens.ts` Symbol per port so tsyringe could resolve an interface-typed dependency, and a concrete `infrastructure/`
adapter implementing each port. That is gone. A use case now constructor-injects the concrete datasource class it needs
(`ForecastsDbDataSource`, `OpenMeteoHttpDataSource`, ...) and calls it directly — no interface, no token, no adapter/port distinction.

## Why

Every port in both packages had exactly one real implementation in production — `ForecastSourcePort` → `OpenMeteoForecastDataSource`,
`SnapshotRepositoryPort` → `SnapshotRepository`, `SweepRepositoryPort` → `SweepRepository`, `LoggerPort` → `PinoLogger`,
`SnapshotDataSourcePort` → `PlanetinhaSnapshotDataSource`. The indirection was buying testability (an in-memory fake standing in for the
interface), not swappable production adapters — the frontend's mock/weather-provider adapters were already deleted for the same reason a
provider-swap flexibility this project doesn't use (see `0002-backend-is-the-sole-open-meteo-client.md`).

That testability turns out not to need an interface at all: TypeScript is structurally typed, so a plain object literal (or, for one-shot
values like `Clock`, a real subclass) can stand in for a concrete class in a test by casting it with `as unknown as <ClassName>`. Nothing
about tsyringe requires an interface either — a concrete-class constructor dependency already resolves without a token, from the same
`emitDecoratorMetadata` mechanism `0004-swc-register-required-by-tsyringe.md` exists to support. Dropping ports removes a file (the port)
and a registration (the token) for every dependency, with no loss of the property that made them worth having.

## Consequences

- `application/` is gone from both packages. Use cases moved into `domain/usecases/`, since a use case is business logic, not a separate
  "application" tier once there's no port to define there.
- `infrastructure/` is gone; it split into `datasource/` (anything reaching an external system: `datasource/db/` per table on the api,
  `datasource/http/` for every HTTP call) and `core/` (env access, logging, plain config — cross-cutting, not domain, not a datasource).
- The api's `infrastructure/database/` repositories (one per use case, e.g. a read-side `SnapshotRepository` and a write-side
  `SweepRepository`) were replaced by one datasource per **table** (`ForecastsDbDataSource`, `GridPointsDbDataSource`,
  `SweepsDbDataSource`), since a repository bundling several tables behind one use case's port no longer has a port to hide behind. A use
  case that needs more than one table's data (e.g. `GetSnapshotUseCase` needs Forecasts and the Sweep state) constructor-injects more than
  one datasource instead.
- `di-container.ts` now registers almost nothing — a concrete class resolves on its own. It exists only where a class must be a shared
  singleton rather than a fresh instance per resolve (the api's `Database` connection and `Logger`). `apps/web` has no singleton-worthy
  class left at all, so it has no `di-container.ts`.
- A plain (non-class) injected value — `SweepConfig` — has no port to hide behind either, so it is no longer resolved from the container.
  The worker composition root builds it from `Env` and passes it straight into `AdvanceSweepUseCase`'s constructor.

## What this doesn't change

- tsyringe stays, unchanged, for the same reason `0004-swc-register-required-by-tsyringe.md` pins the loader: concrete-class resolution via
  `emitDecoratorMetadata` is exactly the mechanism this decision now relies on for everything, not just for the classes that used to be
  registered against a token.
- The worker/api process split (`0002-backend-is-the-sole-open-meteo-client.md`) is a deployment-topology decision independent of layering
  and is untouched by this one.
- This is a deliberate trade against future swappability: if a datasource this project only ever wires to one implementation someday needs a
  second real one, that is the point to reconsider an interface for that specific seam — not to reintroduce one everywhere pre-emptively.
