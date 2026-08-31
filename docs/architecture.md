# Architecture Guide

This document describes the project's architecture and the conventions to follow when implementing new features. Read it carefully before
writing any code. See also `AGENTS.md` for the naming/comment/tooling rules referenced throughout.

---

## Overview

The architecture is inspired by **Clean Architecture** (Robert C. Martin) and the **Ports & Adapters** (hexagonal) pattern. The core idea is
simple: **business logic must not depend on external systems**. Infrastructure (fetch, the Open-Meteo API, Three.js, the DOM) depends on the
domain — never the other way around.

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
├── infrastructure/      # Concrete adapters: HttpClient, Env, Open-Meteo client, mock data source
│   ├── open-meteo/
│   └── mock/
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
export interface TemperatureReading {
  readonly latitude: number
  readonly longitude: number
  readonly temperatureCelsius: number | null
  readonly observedAt: string
}
```

`null` is used explicitly to mean "no data available" and must never be conflated with a real value like `0`.

#### `utils/` — calculation classes

Anything that isn't a plain data shape — algorithms, generators, formatters — is a class with `static` methods, not a module of loose
exported functions, and lives under `domain/utils/` to keep it visually separate from the models/validators/state types at the `domain/`
root. See `ColorScale` (`utils/color-scale.ts`), `TemperatureInterpolator` (`utils/interpolation.ts`), `GridPointsGenerator`
(`utils/grid-points.ts`), `AbortErrorDetector` (`utils/abort-error.ts`). These take plain inputs and return plain outputs with no I/O, which
makes them easy to unit test.

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
(`idle | loading | success | partial-success | stale-error | hard-error`). Model the edge cases explicitly instead of collapsing them into a
single boolean `isLoading`/`error` pair.

---

### `application/` — Use Cases, Ports, and Tokens

Orchestrates domain logic without knowing which concrete infrastructure is behind a port.

#### Ports

An interface owned by `application` that `infrastructure` implements. This is the dependency-inversion seam: a use case only ever talks to
the port, never to a concrete adapter.

```typescript
// ports/temperature-data-source.port.ts
export interface TemperatureDataSourcePort {
  fetchGrid(request: TemperatureGridRequest, signal?: AbortSignal): Promise<TemperatureGrid>
}
```

#### Tokens

Interfaces have no runtime representation, so a port-typed constructor dependency needs an injection token to register/resolve a concrete
implementation against. All tokens live in one place, `src/application/tokens.ts`:

```typescript
export const TOKENS = {
  TemperatureDataSourcePort: Symbol('TemperatureDataSourcePort'),
} as const
```

#### Use cases

A use case is an `@injectable()` class with an `execute()` method. Dependencies are constructor-injected — a port dependency via
`@inject(TOKENS.X)`, a concrete class dependency with no decorator at all (tsyringe resolves concrete classes directly).

```typescript
@injectable()
export class FetchTemperatureGridUseCase {
  constructor(
    @inject(TOKENS.TemperatureDataSourcePort) private readonly dataSource: TemperatureDataSourcePort,
  ) {}

  execute(signal?: AbortSignal): Promise<TemperatureGrid> {
    return this.dataSource.fetchGrid({ resolutionDegrees: DEFAULT_GRID_RESOLUTION_DEGREES }, signal)
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

#### `Env` (`env.service.ts`)

Typed, autocompletable access to environment variables. Never read `import.meta.env` directly anywhere else — add a static getter here
instead:

```typescript
export class Env {
  static get OPEN_METEO_FORECAST_URL(): string {
    return /* import.meta.env.VITE_OPEN_METEO_FORECAST_URL, validated non-empty */
  }
}
```

Vite only exposes vars prefixed `VITE_` to client code, so `.env` stores `VITE_OPEN_METEO_FORECAST_URL` — the `Env` getter drops the prefix,
since that's a Vite implementation detail the rest of the app shouldn't need to know about. `.env` is git-ignored; `.env.example` documents
the required keys for onboarding. A new variable needs an entry in `.env.example`, a typed field in `src/vite-env.d.ts`, and a getter on
`Env`.

We don't use the `dotenv` npm package here: it reads `process.env` in Node and can't run in browser-bundled code, so it wouldn't do anything
useful inside `Env`. Vite's own `.env` loading (which wraps `dotenv` internally, at build time) already covers this.

#### Data sources

Concrete `@injectable()` implementations of a port, grouped one subfolder per external dependency (`open-meteo/`, `mock/`),
constructor-injecting `HttpClient` when they need it:

```typescript
@injectable()
export class OpenMeteoTemperatureDataSource implements TemperatureDataSourcePort {
  constructor(private readonly httpClient: HttpClient) {}

  async fetchGrid(request: TemperatureGridRequest, signal?: AbortSignal): Promise<TemperatureGrid> {
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

The only file allowed to call `container.register*`. Decides which concrete port implementation is wired in, based on
`import.meta.env.MODE`:

```typescript
export class DiContainer {
  static setup(): void {
    if (import.meta.env.MODE === 'mock') {
      container.registerSingleton(TOKENS.TemperatureDataSourcePort, MockTemperatureDataSource)
    } else {
      container.registerSingleton(TOKENS.TemperatureDataSourcePort, OpenMeteoTemperatureDataSource)
    }
  }
}
```

`npm run dev:mock` runs Vite with `--mode mock`, which is all that's needed to switch adapters — no env vars required.

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
(`fetchTemperatureGridUseCase`, `selectPointUseCase`) all the way to the hooks that use them:

```typescript
export function useSelectedPoint(
  grid: TemperatureGrid | null,
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
export class OpenMeteoTemperatureDataSource implements TemperatureDataSourcePort {
  private async fetchBatch(points: readonly GridPoint[], signal?: AbortSignal) {
    const body = await this.httpClient.getJson<unknown>(url, { signal })
    if (isErrorResponse(body)) {
      throw new Error(`A API de temperatura retornou um erro: ${body.reason}`)
    }
    // ...
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

Create `src/domain/wind-reading.ts`:

```typescript
export interface WindReading {
  readonly latitude: number
  readonly longitude: number
  readonly speedKmh: number | null
  readonly observedAt: string
}
```

### 2. Add a port and a token

Create `src/application/ports/wind-data-source.port.ts`:

```typescript
export interface WindGridRequest {
  readonly resolutionDegrees: number
}

export interface WindDataSourcePort {
  fetchGrid(request: WindGridRequest, signal?: AbortSignal): Promise<readonly WindReading[]>
}
```

Add its token to `src/application/tokens.ts`:

```typescript
export const TOKENS = {
  TemperatureDataSourcePort: Symbol('TemperatureDataSourcePort'),
  WindDataSourcePort: Symbol('WindDataSourcePort'),
} as const
```

### 3. Create the use case

Create `src/application/fetch-wind-grid.use-case.ts` as an `@injectable()` class following the pattern in
`fetch-temperature-grid.use-case.ts` — inject the port via `@inject(TOKENS.WindDataSourcePort)`, expose `execute()`.

### 4. Implement the adapter(s)

Create `src/infrastructure/<provider>/<provider>-wind.data-source.ts`, an `@injectable()` class implementing `WindDataSourcePort`, injecting
`HttpClient` for any HTTP calls. Add a mock counterpart in `src/infrastructure/mock/` if the UI needs to be developed without hitting the
real API.

### 5. Register it in the DI container

In `src/di-container.ts`, register the port token against the real/mock adapter, the same way `TemperatureDataSourcePort` is registered
today.

### 6. Resolve and wire it in the composition root

In `src/main.tsx`, resolve the new use case from the container and pass it down as a prop — the same way `fetchTemperatureGridUseCase` is
passed to `<App />` today.

### 7. Consume it from a hook

Create `src/presentation/hooks/use-wind-grid.hook.ts` mirroring `use-temperature-grid.hook.ts`: receive the use case as a parameter, run it
in a `useEffect` with an `AbortController`, and expose the result as an explicit state union (add a `kind` variant or a sibling type to
`DataFetchStatus`, whichever fits).

### 8. Write tests

- `tests/unit/` — domain classes and adapters, mocking `fetch` where needed (see `open-meteo-temperature.data-source.test.ts`).
- `tests/component/` — React Testing Library, rendering a component with a fake use case.
- `tests/integration/` — a use case wired to a real (or mock) port end-to-end (see `fetch-temperature-grid.use-case.test.ts`).

---
