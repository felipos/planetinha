# Architecture Guide

This document describes the project's architecture and the conventions to follow when implementing new features. Read it carefully before
writing any code. See also `AGENTS.md` for the naming/comment/tooling rules referenced throughout, and `docs/running.md` for how to actually
run the stack.

The repo is a two-package workspace — `apps/web` (React frontend) and `apps/api` (Fastify + Postgres backend, with a worker sharing its
codebase and image). **Both follow the same architecture**, described below once; the section _The api package_ at the end covers only where
it differs.

---

## Overview

The architecture is inspired by **Clean Architecture** (Robert C. Martin) and the **Ports & Adapters** (hexagonal) pattern. The core idea is
simple: **business logic must not depend on external systems**. Infrastructure (fetch, Postgres, Three.js, the DOM) depends on the domain —
never the other way around.

Dependency injection is handled by [tsyringe](https://github.com/microsoft/tsyringe). Domain, application, and infrastructure code is
written as classes; React components and hooks are the one exception, since hooks require function components.

---

## Layer Structure

```
src/
├── domain/             # Business logic: models, validators, and state-shape types — zero framework knowledge
│   └── utils/           # Stateless calculation/algorithm classes (color scale, interpolation, grid generation, ...)
├── application/        # Use cases + ports (interfaces) + DI tokens
│   └── ports/           # Interfaces implemented by infrastructure
├── infrastructure/      # Concrete adapters: HttpClient, Env, the client for Vento's own API
│   └── vento/
├── di-container.ts      # tsyringe container registration — the only file allowed to call container.register*
└── presentation/        # React components and hooks (the only layer allowed to know about React/DOM)
    ├── components/
    └── hooks/
```

### Dependency Rule

Arrows below indicate the **allowed** direction of dependency. Inner layers never import from outer layers.

```
presentation
    └──> application
    └──> domain

application
    └──> domain
    (defines ports + DI tokens; never imports a concrete infrastructure class)

infrastructure
    └──> application/ports  (implements the interface)
    └──> domain

domain
    (no outgoing dependencies on the other layers)
```

The composition root (`src/main.tsx`) is the only file that calls `container.resolve()`. It resolves the use cases the app needs and passes
them down to `presentation` as props — components and hooks never resolve a dependency themselves, which keeps them trivially testable with
a fake use case and no container involved in tests.

---

## Naming Conventions

See `AGENTS.md` for the full naming rules. In short: every directory and file is `kebab-case`, and a file that plays a specific
architectural role carries a suffix naming that role — `*.use-case.ts`, `*.data-source.ts`, `*.port.ts`, `*.service.ts`, `*.validator.ts`,
`*.hook.ts`, `*.component.tsx`. A CSS file paired with a component keeps the component's bare name, with no suffix. Plain domain value
types/interfaces that aren't a "layer" (e.g. `temperature-reading.ts`) keep a bare kebab-case name.

---

## Layers in Detail

### `domain/` — Business Logic

The heart of the application. Has **zero knowledge** of `fetch`, Three.js, or the DOM.

#### Models

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

#### `utils/` — calculation classes

Anything that isn't a plain data shape — algorithms, generators, formatters — is a class with `static` methods, not a module of loose
exported functions, and lives under `domain/utils/` to keep it visually separate from the models/validators/state types at the `domain/`
root. See `ColorScale` (`utils/color-scale.ts`), `CellLocator` (`utils/cell-locator.ts`), `CoverageCalculator` (`utils/coverage.ts`),
`AbortErrorDetector` (`utils/abort-error.ts`). These take plain inputs and return plain outputs with no I/O, which makes them easy to unit
test.

```typescript
export class ColorScale {
  static readonly TEMPERATURE_COLOR_STOPS: readonly ColorStop[] = [
    /* ... */
  ]

  static temperatureToRgb(celsius: number): readonly [number, number, number] {
    /* ... */
  }
}
```

#### Validators

A validator is a dedicated `*.validator.ts` file with a class of `static` methods, separate from the model it validates
(`temperature-reading.ts` holds the `TemperatureReading` interface; `temperature-reading.validator.ts` holds `TemperatureReadingValidator`).

#### State-shape types

Discriminated unions that make illegal UI states unrepresentable are also domain concepts — e.g. `DataFetchStatus`
(`idle | loading | success | initial-load | partial-success | stale-error | hard-error`, where `initial-load` and `partial-success` are the
same Coverage number meaning two different things). Model the edge cases explicitly instead of collapsing them into a single boolean
`isLoading`/`error` pair.

---

### `application/` — Use Cases, Ports, and Tokens

Orchestrates domain logic without knowing which concrete infrastructure is behind a port.

#### Ports

An interface owned by `application` that `infrastructure` implements. This is the dependency-inversion seam: a use case only ever talks to
the port, never to a concrete adapter.

```typescript
// ports/snapshot-data-source.port.ts
export interface SnapshotDataSourcePort {
  fetchSnapshot(signal?: AbortSignal): Promise<Snapshot>
}
```

#### Tokens

Interfaces have no runtime representation, so a port-typed constructor dependency needs an injection token to register/resolve a concrete
implementation against. All tokens live in one place, `src/application/tokens.ts`:

```typescript
export const TOKENS = {
  SnapshotDataSourcePort: Symbol('SnapshotDataSourcePort'),
} as const
```

#### Use cases

A use case is an `@injectable()` class with an `execute()` method. Dependencies are constructor-injected — a port dependency via
`@inject(TOKENS.X)`, a concrete class dependency with no decorator at all (tsyringe resolves concrete classes directly).

```typescript
@injectable()
export class FetchSnapshotUseCase {
  constructor(@inject(TOKENS.SnapshotDataSourcePort) private readonly dataSource: SnapshotDataSourcePort) {}

  execute(signal?: AbortSignal): Promise<Snapshot> {
    return this.dataSource.fetchSnapshot(signal)
  }
}
```

Rules:

- One use case = one operation.
- A use case never imports a concrete `infrastructure` class — only ports and other injectable classes.
- Config constants (`config.ts`) are imported directly rather than injected — they're plain values, not swappable dependencies.

---

### `infrastructure/` — Adapters and Services

#### `HttpClient` (`http-client.service.ts`)

Every data source that needs to make an HTTP call goes through this `@injectable()` class instead of calling `fetch` directly. It wraps
`fetch` with retry-with-backoff on HTTP 429 and abort propagation — generic HTTP-transport concerns every data source gets for free. It
knows nothing about any specific API's response shape; that stays in the data source.

```typescript
@injectable()
export class HttpClient {
  async getJson<T>(url: string, options?: HttpGetOptions): Promise<T> {
    /* ... */
  }
}
```

#### `Env` (`env.service.ts`, api only)

Typed, autocompletable access to environment variables. Never read `process.env` anywhere else — add a static getter here instead:

```typescript
export class Env {
  static get DATABASE_URL(): string {
    return Env.required('DATABASE_URL')
  }
}
```

A new variable needs a getter here and an entry in `apps/api/.env.example`. `.env` is git-ignored and read only on the host (via Node's
`--env-file-if-exists`, so no `dotenv` package); containers get their values from `compose.yaml`.

**`apps/web` has no environment variables at all**, and should not gain any. It calls a relative API path in every environment — proxied by
the dev server locally and by the reverse proxy in production — so there is no base URL to configure and no CORS to set up. Deleting the
frontend's `Env` service was part of that change, not an oversight.

#### Data sources

Concrete `@injectable()` implementations of a port, grouped one subfolder per external dependency (`open-meteo/`, `mock/`),
constructor-injecting `HttpClient` when they need it:

```typescript
@injectable()
export class VentoSnapshotDataSource implements SnapshotDataSourcePort {
  constructor(private readonly httpClient: HttpClient) {}

  async fetchSnapshot(signal?: AbortSignal): Promise<Snapshot> {
    /* ... */
  }
}
```

Rules:

- Implement a port interface from `application/ports`.
- Make every HTTP call through `HttpClient` — never call `fetch` directly.
- Do all response parsing/mapping to domain models _inside_ the adapter. This project talks to a single small external API per port, so a
  separate `datasources/` + `mappers/` split (as you'd want with many external APIs) would be premature — if a port grows multiple real
  adapters with non-trivial response shapes, revisit this and extract mapping into dedicated files.
- Throw a plain `Error` with a human-readable message on failure (see **Error Handling** below).
- Respect the `AbortSignal` passed into every port method — this is what lets `presentation` cancel a stale fetch (e.g. React `StrictMode`'s
  double-invoke in dev, or unmount) without wasting API quota.

#### `di-container.ts`

The only file allowed to call `container.register*`. Decides which concrete port implementation is wired in:

```typescript
export class DiContainer {
  static setup(): void {
    container.registerSingleton(TOKENS.SnapshotDataSourcePort, VentoSnapshotDataSource)
  }
}
```

There is one implementation and no mode switch. The frontend's mock adapter and its adapter for the weather provider were both deleted: the
browser talks to Vento's backend or to nothing at all — see `docs/adr/0002-backend-is-the-sole-open-meteo-client.md`. In the api, this is
also the only place that reads `Env` into injected configuration.

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

- Anything that can fail at the I/O boundary (an `infrastructure` adapter) throws a plain `Error` with a clear, user-facing message.
- The `presentation` layer (typically a hook) is the single place that catches these errors and translates them into an explicit state shape
  — see `DataFetchStatus` in `src/domain/data-fetch-status.ts`.
- `AbortErrorDetector.isAbortError()` detects an intentional cancellation and treats it as a no-op, not a failure.
- A failure after a previous success does not wipe the UI: it becomes `stale-error`, keeping the last good data (`lastGood`) visible
  alongside the error message, instead of reverting to a blank/error screen.

```typescript
// ✅ Correct — throw at the boundary, convert to explicit state at the presentation edge
@injectable()
export class VentoSnapshotDataSource implements SnapshotDataSourcePort {
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

Create `src/domain/wind.ts` — named in the glossary's vocabulary, like every other domain type:

```typescript
export interface Wind {
  readonly latitude: number
  readonly longitude: number
  readonly speedKmh: number | null
  readonly validAt: string
}
```

### 2. Add a port and a token

Create `src/application/ports/wind-data-source.port.ts`:

```typescript
export interface WindDataSourcePort {
  fetchWind(signal?: AbortSignal): Promise<readonly Wind[]>
}
```

Add its token to `src/application/tokens.ts`:

```typescript
export const TOKENS = {
  SnapshotDataSourcePort: Symbol('SnapshotDataSourcePort'),
  WindDataSourcePort: Symbol('WindDataSourcePort'),
} as const
```

### 3. Create the use case

Create `src/application/fetch-wind.use-case.ts` as an `@injectable()` class following the pattern in `fetch-snapshot.use-case.ts` — inject
the port via `@inject(TOKENS.WindDataSourcePort)`, expose `execute()`.

### 4. Implement the adapter(s)

Create `src/infrastructure/vento/vento-wind.data-source.ts`, an `@injectable()` class implementing `WindDataSourcePort`, injecting
`HttpClient` for the HTTP call and validating the response body before returning it.

Note what does **not** happen here: the frontend does not gain an adapter for a weather provider, and does not gain a mock one either. New
data comes from Vento's own backend, and any mock belongs there — see `docs/adr/0002-backend-is-the-sole-open-meteo-client.md`. On the api
side, the provider-facing adapter goes in `src/infrastructure/<provider>/` and is called only from the worker's path.

### 5. Register it in the DI container

In `src/di-container.ts`, register the port token against the adapter, the same way `SnapshotDataSourcePort` is registered today.

### 6. Resolve and wire it in the composition root

In `src/main.tsx`, resolve the new use case from the container and pass it down as a prop — the same way `fetchSnapshotUseCase` is passed to
`<App />` today.

### 7. Consume it from a hook

Create `src/presentation/hooks/use-wind.hook.ts` mirroring `use-snapshot.hook.ts`: receive the use case as a parameter, run it in a
`useEffect` with an `AbortController`, and expose the result as an explicit state union (add a `kind` variant or a sibling type to
`DataFetchStatus`, whichever fits).

### 8. Write tests

- `tests/unit/` — domain classes and adapters, mocking `fetch` where needed (see `snapshot-response.validator.test.ts`).
- `tests/component/` — React Testing Library, rendering a component with a fake use case.
- `tests/integration/` — a use case wired to a fake port end-to-end (see `fetch-snapshot.use-case.test.ts`).

---

## The api package

`apps/api` follows everything above — the same layers, the same dependency rule, the same ports, tokens, and file-role suffixes — with the
differences below and nothing else.

### Where things go

```
apps/api/src/
├── domain/              # Grid Point, Forecast, Sweep, Snapshot, TickOutcome + utils/
├── application/         # Use cases, ports/, tokens.ts, config.ts, sweep-config.ts
├── infrastructure/      # HttpClient, Env, Clock, PinoLogger
│   ├── database/         # Drizzle schema, Database, repositories, the boot readiness check
│   └── open-meteo/       # The adapter behind ForecastSourcePort
├── presentation/routes/ # HTTP routes: request in, use case out, response body back
├── di-container.ts      # The only file that calls container.register*
├── server.ts            # Builds the Fastify instance WITHOUT listening — the test seam
├── main.ts              # Entrypoint: the api
├── worker.ts            # Entrypoint: the worker
└── scripts/             # migrate.ts, seed-grid.ts — run explicitly, never on boot
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

### Repositories

A repository is the concrete side of a port over Postgres (`*.repository.ts`, in `infrastructure/database/`). Two rules earn their keep:

- **A write that must be atomic is one `commitSlice`-style method, not several calls the use case sequences.** The Sweep cursor advancing
  and that Slice's Forecasts landing in the same transaction is what makes a crash replay a Slice instead of losing it.
- Anything Postgres-specific — SQLSTATE codes, `excluded.*` in an upsert, left joins that keep Grid Points with No Data — stays here.

### Testing

Node's built-in runner (`node:test`), at three seams, all with no database and no network:

- `tests/http/` — requests injected into the real Fastify instance with a fake repository. The highest seam available, and the one that
  would catch a serialization or schema mistake.
- `tests/integration/` — one Tick through the sweep use case, with a fake forecast source and a fake repository. The write path has no HTTP
  surface, so the use case is as high as it goes.
- `tests/unit/` — the upstream adapter with `fetch` mocked, and pure domain classes. This is where the provider's payload shape is pinned
  down, which the fake port in the seam above cannot do.

Fakes live in `tests/fixtures/` with the `*.fixture.ts` suffix, and a fake models the real thing's _rules_ — the in-memory sweep repository
keys Forecasts by (Grid Point, Valid At) exactly as the table does, so a replayed Slice overwrites there too.

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
