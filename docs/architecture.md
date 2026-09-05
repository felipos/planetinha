# Architecture Guide

This document describes the project's architecture and the conventions to follow when implementing new features. Read it carefully before
writing any code. See also `AGENTS.md` for the naming/comment/tooling rules referenced throughout, and `docs/running.md` for how to actually
run the stack.

The repo is a two-package workspace — `apps/web` (React frontend) and `apps/api` (Fastify + Postgres backend, with a worker sharing its
codebase and image). **Both follow the same architecture**, described below once; the section _The api package_ at the end covers only where
it differs.

---

## Overview

The architecture favors simplicity over indirection: a **presentation** layer that receives requests, a **domain** layer that holds business
logic (models and use cases), and a **datasource** layer that is the only place allowed to reach an external system (a database, an HTTP
API). There is no interface between a use case and the datasource it calls — a use case constructor-injects the concrete datasource class it
needs and calls it directly. See `docs/adr/0005-drop-ports-for-direct-references.md` for why: the earlier ports-and-adapters design bought
testability that a plain fake object already gives without an interface, at the cost of an extra file and an injection token for every
dependency this project only ever wired to one real implementation.

Dependency injection is handled by [tsyringe](https://github.com/microsoft/tsyringe). Domain, datasource, and core code is written as
classes; React components and hooks are the one exception, since hooks require function components. A class-typed constructor dependency
needs no registration at all — tsyringe resolves it from the decorator metadata emitted for the constructor. The only reason a class needs
an entry in `di-container.ts` is to be a **shared singleton** rather than a fresh instance per resolve.

---

## Layer Structure

```
src/
├── core/                # Cross-cutting, non-domain concerns: env access, logging, plain config
├── domain/
│   ├── models/           # Business logic data shapes: plain interfaces, validators, state-shape types
│   ├── usecases/         # One class per operation — the business logic, calling datasources directly
│   └── utils/             # Stateless calculation/algorithm classes (color scale, interpolation, grid generation, ...)
├── datasource/
│   ├── db/                # Direct database access, one class per table/entity (api only)
│   └── http/               # Direct HTTP access: a shared HttpClient, one class per external API
├── di-container.ts        # tsyringe container registration — the only file allowed to call container.register*
└── presentation/           # React components and hooks (the only layer allowed to know about React/DOM)
    ├── components/
    └── hooks/
```

### Dependency Rule

Arrows below indicate the **allowed** direction of dependency. A use case may reference a datasource class directly — there is no interface
to route through.

```
presentation
    └──> domain

domain/usecases
    └──> domain/models, domain/utils
    └──> datasource/db, datasource/http
    └──> core

datasource
    └──> domain/models (for the shapes it returns)
    └──> core (for Env, Logger, HttpClient)

domain/models, domain/utils
    (no outgoing dependencies on the other layers)
```

The composition root (`src/main.tsx`) is the only file that calls `container.resolve()`. It resolves the use cases the app needs and passes
them down to `presentation` as props — components and hooks never resolve a dependency themselves, which keeps them trivially testable with
a fake use case and no container involved in tests.

---

## Naming Conventions

See `AGENTS.md` for the full naming rules. In short: every directory and file is `kebab-case`, and a file that plays a specific
architectural role carries a suffix naming that role — `*.usecase.ts`, `*.datasource.ts`, `*.service.ts`, `*.validator.ts`, `*.entity.ts`
(api only), `*.route.ts` (api only), `*.hook.ts`, `*.component.tsx`. A CSS file paired with a component keeps the component's bare name,
with no suffix. Plain domain value types/interfaces that aren't a "layer" (e.g. `temperature-reading.ts`) keep a bare kebab-case name.

---

## Layers in Detail

### `core/` — Cross-Cutting Concerns

Nothing here is domain logic or business-specific: env access (`env.service.ts`, api only), logging (`logger.service.ts`, api only), and
plain configuration constants/interfaces (`config.ts`, and `sweep-config.ts` on the api) — everything a use case or a datasource needs that
isn't itself a domain concept.

```typescript
export class Env {
  static get DATABASE_URL(): string {
    return Env.required('DATABASE_URL')
  }
}
```

### `domain/` — Business Logic

The heart of the application. Has **zero knowledge** of `fetch`, Postgres, Three.js, or the DOM.

#### `models/` — plain data shapes

Plain, `readonly` TypeScript interfaces representing domain entities — interfaces, not classes, since they're pure data shapes with no
behavior. No serialization concerns, no framework types.

```typescript
// ✅ Domain model — clean, no framework dependencies
export interface Forecast {
  readonly latitude: number
  readonly longitude: number
  readonly temperatureCelsius: number | null
  readonly validAt: string
}
```

Domain types are named in the glossary's vocabulary (`CONTEXT.md`), and so are the fields on them. A type called `TemperatureReading` with
an `observedAt` would be claiming something false: nothing observed these values, a weather model produced them.

`null` is used explicitly to mean "no data available" and must never be conflated with a real value like `0`.

A validator is a dedicated `*.validator.ts` file with a class of `static` methods, next to the model it validates inside `models/`
(`forecast.ts` holds the `Forecast` interface; `forecast.validator.ts` holds `ForecastValidator`).

State-shape types — discriminated unions that make illegal UI states unrepresentable — are also domain concepts and live in `models/` too —
e.g. `DataFetchStatus` (`idle | loading | success | initial-load | partial-success | stale-error | hard-error`, where `initial-load` and
`partial-success` are the same Coverage number meaning two different things). Model the edge cases explicitly instead of collapsing them
into a single boolean `isLoading`/`error` pair.

#### `usecases/` — business logic

A use case is an `@injectable()` class with an `execute()` method. Every constructor dependency — a datasource, another use case, a `core/`
service — is a concrete class, constructor-injected with no decorator at all: tsyringe resolves a concrete class directly from its emitted
decorator metadata.

```typescript
@injectable()
export class FetchSnapshotUseCase {
  constructor(private readonly dataSource: PlanetinhaHttpDataSource) {}

  execute(signal?: AbortSignal): Promise<Snapshot> {
    return this.dataSource.fetchSnapshot(signal)
  }
}
```

Rules:

- One use case = one operation.
- A use case may hold basic validation/orchestration logic, but request parsing and response shaping stay in `presentation`.
- Config constants (`core/config.ts`) are imported directly rather than injected — they're plain values, not swappable dependencies.

#### `utils/` — calculation classes

Anything that isn't a plain data shape — algorithms, generators, formatters — is a class with `static` methods, not a module of loose
exported functions, and lives under `domain/utils/` to keep it visually separate from `models/` and `usecases/`. See `ColorScale`
(`utils/color-scale.ts`), `CellLocator` (`utils/cell-locator.ts`), `CoverageCalculator` (`utils/coverage.ts`), `AbortErrorDetector`
(`utils/abort-error.ts`). These take plain inputs and return plain outputs with no I/O, which makes them easy to unit test.

---

### `datasource/` — Direct Access to External Systems

The only layer allowed to reach outside the process. Grouped by transport, not by feature: `db/` for direct database access, `http/` for
direct HTTP calls.

#### `datasource/http/`

`HttpClient` (`http-client.service.ts`) is an `@injectable()` class every HTTP-calling datasource constructor-injects instead of calling
`fetch` directly. It wraps `fetch` with retry-with-backoff on HTTP 429 and abort propagation — generic HTTP-transport concerns every
datasource gets for free. It knows nothing about any specific API's response shape; that stays in the datasource.

A datasource is a concrete `@injectable()` class named after the external API it calls (e.g. `open-meteo.http.datasource.ts` →
`OpenMeteoHttpDataSource`, api only), constructor-injecting `HttpClient`:

```typescript
@injectable()
export class OpenMeteoHttpDataSource {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly clock: Clock,
  ) {}

  async fetchForecastWindow(gridPoints: readonly StoredGridPoint[]): Promise<FetchedForecastWindow> {
    /* ... */
  }
}
```

Rules:

- Make every HTTP call through `HttpClient` — never call `fetch` directly.
- Do all response parsing/mapping to domain models _inside_ the datasource.
- Throw a plain `Error` with a human-readable message on failure (see **Error Handling** below).
- Respect the `AbortSignal` passed into every method — this is what lets `presentation` cancel a stale fetch (e.g. React `StrictMode`'s
  double-invoke in dev, or unmount) without wasting API quota.

#### `datasource/db/` (api only)

A datasource here is named after the **table it owns**, not after a use case — `forecasts.db.datasource.ts`, `grid-points.db.datasource.ts`,
`sweeps.db.datasource.ts`. A use case that needs data spanning more than one table (e.g. `GetSnapshotUseCase` needs both Forecasts and the
Sweep state) simply constructor-injects more than one datasource; nothing bundles them into a single repository, because "Snapshot" is a
domain concept assembled in `domain/`, not a table.

```typescript
@injectable()
export class ForecastsDbDataSource {
  constructor(private readonly database: Database) {}

  async findStoredForecasts(
    validAt: Date,
    resolutionDegrees: number,
  ): Promise<readonly StoredSnapshotForecast[]> {
    /* ... */
  }
}
```

`db/entities/` holds the Drizzle table definitions, one file per table (`*.entity.ts`), with `entities/schema.ts` re-exporting all of them
for the Drizzle client and `drizzle-kit`. `database.service.ts` (the shared Postgres connection) and `database-readiness.service.ts` (the
boot check) live directly under `datasource/db/`, shared by every table's datasource rather than duplicated.

Rules:

- A write that must be atomic is one method on the datasource that owns the transaction (e.g. `SweepsDbDataSource.commitSlice`), not several
  calls the use case sequences. The Sweep cursor advancing and that Slice's Forecasts landing in the same transaction is what makes a crash
  replay a Slice instead of losing it.
- Anything Postgres-specific — SQLSTATE codes, `excluded.*` in an upsert, left joins that keep Grid Points with No Data — stays here.

---

### `di-container.ts`

The only file allowed to call `container.register*`. Most classes need no entry here at all — a concrete constructor dependency resolves on
its own. This file exists only for a class that must be a **shared singleton** rather than a fresh instance per resolve:

```typescript
export class DiContainer {
  static setup(): void {
    container.registerSingleton(Database)
    container.registerSingleton(Logger)
  }
}
```

On the api, that's the one Postgres connection (`Database`) and the one Pino instance (`Logger`) the process uses. The frontend has neither
a shared connection nor a shared logger, so it has no `di-container.ts` at all — `main.tsx` resolves its use cases straight from the
container with zero registration required.

A pacing value like `SweepConfig` is a plain object, not a class, so it is never resolved from the container either way — the worker builds
it from `Env` and passes it straight into `AdvanceSweepUseCase`'s constructor (see _The api package_ below).

---

### `presentation/` — React Components and Hooks

The only layer allowed to import React, touch the DOM, or use Three.js, and the one place where the classes-over-functions rule doesn't
apply to the components/hooks themselves — a React hook only works inside a function component. Structure:

```
presentation/
├── app.component.tsx
├── components/
│   └── <kebab-name>/
│       ├── <kebab-name>.component.tsx
│       └── <kebab-name>.css
└── hooks/
    └── use-<something>.hook.ts
```

A non-hook, non-component helper module inside `presentation` still follows the classes-over-functions rule — see `SphereProjection`
(`sphere-projection.ts`) and `HeatmapTexture` (`heatmap-texture.ts`) inside `components/globe/`, both plain classes with `static` methods.

`src/main.tsx` (the composition root) resolves every use case the app needs from the container and passes them down as props
(`fetchSnapshotUseCase`, `selectPointUseCase`) all the way to the hooks that use them:

```typescript
export function useSelectedPoint(
  snapshot: Snapshot | null,
  selectPointUseCase: SelectPointUseCase,
): UseSelectedPointResult {
  /* ... */
}
```

---

## Error Handling

This project does **not** use a `Result<T, E>` return type on every function. Instead:

- Anything that can fail at the I/O boundary (a `datasource` class) throws a plain `Error` with a clear, user-facing message.
- The `presentation` layer (typically a hook) is the single place that catches these errors and translates them into an explicit state shape
  — see `DataFetchStatus` in `src/domain/models/data-fetch-status.ts`.
- `AbortErrorDetector.isAbortError()` detects an intentional cancellation and treats it as a no-op, not a failure.
- A failure after a previous success does not wipe the UI: it becomes `stale-error`, keeping the last good data (`lastGood`) visible
  alongside the error message, instead of reverting to a blank/error screen.

```typescript
// ✅ Correct — throw at the boundary, convert to explicit state at the presentation edge
@injectable()
export class PlanetinhaHttpDataSource {
  async fetchSnapshot(signal?: AbortSignal): Promise<Snapshot> {
    const body = await this.httpClient.getJson<unknown>(SNAPSHOT_PATH, { signal })
    return SnapshotResponseValidator.toSnapshot(body) // throws a stated error on a malformed body
  }
}
```

If a future feature needs richer error metadata (an error code, a status, structured fields), prefer extending `DataFetchStatus`-style
discriminated unions scoped to that feature's state, rather than introducing a generic `Result<T, E>` pair used everywhere — that pattern
earns its keep in a backend with many failure-prone service calls per request; it's more ceremony than this small client app needs today.

---

## Comments

See `AGENTS.md`. The short version: explain the non-obvious _why_, never point at a user story, ticket, or external spec/doc file — those
get edited or deleted, turning the comment into a dangling, misleading reference.

---

## Step-by-Step: Adding a New Feature

Suppose you need to add a new kind of data to the globe (e.g. wind speed) fetched from a new external source.

### 1. Add a domain model

Create `src/domain/models/wind.ts` — named in the glossary's vocabulary, like every other domain type:

```typescript
export interface Wind {
  readonly latitude: number
  readonly longitude: number
  readonly speedKmh: number | null
  readonly validAt: string
}
```

### 2. Create the use case

Create `src/domain/usecases/fetch-wind.usecase.ts` as an `@injectable()` class following the pattern in `fetch-snapshot.usecase.ts` —
constructor-inject the datasource(s) it needs directly, expose `execute()`.

### 3. Implement the datasource

Create `src/datasource/http/<provider>.http.datasource.ts`, an `@injectable()` class named after the external API, constructor-injecting
`HttpClient` for the call and validating the response body before returning it.

Note what does **not** happen here: the frontend does not gain a datasource for a weather provider directly. New data comes from
Planetinha's own backend — see `docs/adr/0002-backend-is-the-sole-open-meteo-client.md`. On the api side, the provider-facing datasource is
called only from the worker's path.

### 4. Wire it in the composition root

In `src/main.tsx`, resolve the new use case from the container and pass it down as a prop — the same way `fetchSnapshotUseCase` is passed to
`<App />` today. No `di-container.ts` entry is needed unless the new datasource must be a shared singleton.

### 5. Consume it from a hook

Create `src/presentation/hooks/use-wind.hook.ts` mirroring `use-snapshot.hook.ts`: receive the use case as a parameter, run it in a
`useEffect` with an `AbortController`, and expose the result as an explicit state union (add a `kind` variant or a sibling type to
`DataFetchStatus`, whichever fits).

### 6. Write tests

- `tests/unit/` — domain classes and datasources, mocking `fetch` where needed (see `snapshot-response.validator.test.ts`).
- `tests/component/` — React Testing Library, rendering a component with a fake use case.
- `tests/integration/` — a use case wired to a fake datasource end-to-end (see `fetch-snapshot.usecase.test.ts`).

A fake datasource is a plain object literal satisfying the concrete class's public shape, cast with `as unknown as <DatasourceClass>` —
there's no interface to implement, so the cast is what lets a duck-typed fake stand in for the class type. See
`createFakeForecastsDataSource` (api) or `createFakeDataSource` in `fetch-snapshot.usecase.test.ts` (web).

---

## The api package

`apps/api` follows everything above — the same layers, the same dependency rule, the same file-role suffixes — with the differences below
and nothing else.

### Where things go

```
apps/api/src/
├── core/                 # Env, config.ts, sweep-config.ts, Logger
├── domain/
│   ├── models/            # Grid Point, Forecast, Sweep, Snapshot, TickOutcome + validators
│   ├── usecases/          # GetSnapshotUseCase, AdvanceSweepUseCase, CheckHealthUseCase
│   └── utils/
├── datasource/
│   ├── db/
│   │   ├── entities/       # forecasts.entity.ts, grid-points.entity.ts, sweeps.entity.ts, schema.ts
│   │   ├── database.service.ts
│   │   ├── database-readiness.service.ts
│   │   ├── forecasts.db.datasource.ts
│   │   ├── grid-points.db.datasource.ts
│   │   └── sweeps.db.datasource.ts
│   └── http/
│       ├── http-client.service.ts
│       └── open-meteo.http.datasource.ts  # The api's one door to the upstream weather provider
├── presentation/routes/  # HTTP routes: request in, use case out, response body back
├── di-container.ts       # Registers Database and Logger as singletons — nothing else needs it
├── server.ts              # Builds the Fastify instance WITHOUT listening — the test seam
├── main.ts                # Entrypoint: the api
├── worker.ts               # Entrypoint: the worker
└── scripts/                # migrate.ts, seed-grid.ts — run explicitly, never on boot
```

### Routes are the presentation layer

A route translates an HTTP request into a use-case call and its result into a response body, and holds no logic of its own. The use case is
**passed in**, not resolved, so a route can be exercised with a fake one and no container:

```typescript
export class SnapshotRoute {
  static register(app: FastifyInstance, getSnapshotUseCase: GetSnapshotUseCase): void {
    app.get('/api/snapshot', async () => SnapshotRoute.toBody(await getSnapshotUseCase.execute()))
  }
}
```

`Server.build()` wires the routes and returns the instance without binding a port; binding is `main.ts`'s job. That split is what makes the
read path testable through the real route.

### Datasources are split by table, not by use case

`GetSnapshotUseCase` constructor-injects both `ForecastsDbDataSource` and `SweepsDbDataSource`; `AdvanceSweepUseCase` constructor-injects
`SweepsDbDataSource`, `GridPointsDbDataSource`, and `OpenMeteoHttpDataSource`. Nothing bundles these into a single repository per use case —
each datasource answers only for the table it owns.

### Testing

Node's built-in runner (`node:test`), at three seams, all with no database and no network:

- `tests/http/` — requests injected into the real Fastify instance with fake datasources. The highest seam available, and the one that would
  catch a serialization or schema mistake.
- `tests/integration/` — one Tick through the sweep use case, with a fake forecast source and fake datasources. The write path has no HTTP
  surface, so the use case is as high as it goes.
- `tests/unit/` — the upstream datasource with `fetch` mocked, and pure domain classes. This is where the provider's payload shape is pinned
  down, which the fakes in the seam above cannot do.

Fakes live in `tests/fixtures/` with the `*.fixture.ts` suffix, and a fake models the real thing's _rules_ — the in-memory Sweeps fake keys
Forecasts by (Grid Point, Valid At) exactly as the table does, so a replayed Slice overwrites there too.

### The loader

The package runs TypeScript through `@swc-node/register` and type-checks with `tsc --noEmit`. This is not a free choice: tsyringe resolves a
concrete-class dependency from `emitDecoratorMetadata`, Node's native type stripping rejects decorators outright, and esbuild-based loaders
run the code and then fail at **runtime** with an opaque resolution error. Read `docs/adr/0004-swc-register-required-by-tsyringe.md` before
touching the loader, the test command, or the Dockerfile.

### Two entrypoints, one image

`main.ts` serves and `worker.ts` sweeps, from one codebase and one image, differing only by npm script. Exactly one process may call the
weather provider — a worker embedded in the api would multiply upstream traffic by the api's replica count — so **never** move
provider-calling code into a route or a Fastify plugin.

Both entrypoints fail fast at boot when the schema is missing or the Grid has not been seeded, with an instruction naming the step. Nothing
migrates or seeds as a side effect of starting; both are explicit commands (see `docs/running.md`).
