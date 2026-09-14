# AI agents guidelines

- Everything on the project should always be written in english (code, comments, documentation, etc) unless explicit said.

- All dependencies should have its versions fixed. No ^ or ~ caracters. This avoids security problems.

- Every new code should have its respective test cases.

- A function or method that takes more than 2 parameters takes a single options object instead. Two positional parameters or fewer stay
  positional — the rule exists to keep a call site self-describing once there's enough going on that argument order stops being obvious, not
  to force an object around every call. This applies to plain data parameters; a class constructor's injected dependencies and a React
  component's props are unaffected (dependencies are one per line by convention regardless of count, and props are already an object by how
  JSX works).

## Classes over functions

- Domain, application, and infrastructure logic (use cases, data sources, services, validators, and other pure domain logic) is written as
  classes, not standalone exported functions. A stateless algorithm/helper becomes a class with `static` methods instead of a module of
  loose functions (e.g. `ColorScale.temperatureToRgb()`, not an exported `temperatureToRgb()`).
- React function components and hooks are the one exception: they stay as functions, since React hooks (`useState`, `useEffect`, etc.) only
  work inside function components. This rule does not apply to `src/presentation`'s components/hooks themselves — but any plain (non-hook,
  non-component) helper module inside `presentation` still follows the classes-over-functions rule (see `sphere-projection.ts`,
  `heatmap-texture.ts`).

## Dependency injection (tsyringe)

- Use [tsyringe](https://github.com/microsoft/tsyringe) for dependency injection. Decorate injectable classes with `@injectable()`.
- There are no interfaces between layers — a use case constructor-injects the concrete datasource (or other) class it needs and calls it
  directly. A concrete class needs no token or registration; tsyringe resolves it directly from the decorator metadata emitted for its
  constructor. See `docs/adr/0005-drop-ports-for-direct-references.md` for why this project doesn't use ports/adapters.
- All container registration happens in one place: `src/di-container.ts`. No other file should call `container.register*`. Most classes
  never need an entry there at all — it exists only to register a class as a **shared singleton** (e.g. the api's `Database` connection and
  `Logger`) rather than a fresh instance per resolve. A package with nothing that needs to be a singleton has no `di-container.ts` at all
  (see `apps/web`).
- The composition root (`src/main.tsx`) is the only file that calls `container.resolve()`. It resolves the use cases the app needs and
  passes them down as props — components and hooks receive their use case as a parameter, they never resolve one themselves. This keeps
  components/hooks trivially testable with a fake use case, with no container involved in tests. A fake in a test is a plain object literal
  satisfying the concrete class's public shape, cast with `as unknown as <ClassName>` since there's no interface to implement.

## Naming conventions

- Directories and files are `kebab-case`. No `PascalCase` or `camelCase` filenames or directory names anywhere in the project
  (`data-status-banner/`, not `DataStatusBanner/`).
- A file that plays a specific architectural role carries a suffix naming that role:
  - Use case → `*.usecase.ts` (e.g. `fetch-snapshot.usecase.ts`)
  - Data source → `*.datasource.ts`, named after what it talks to — `<provider>.http.datasource.ts` for an HTTP call (e.g.
    `open-meteo.http.datasource.ts`), `<table>.db.datasource.ts` for a database table (api only, e.g. `sweeps.db.datasource.ts`)
  - Service → `*.service.ts` (e.g. `http-client.service.ts`, `env.service.ts`)
  - Validator → `*.validator.ts`
  - Database table definition (api only) → `*.entity.ts` (e.g. `sweeps.entity.ts`), living under `datasource/db/entities/`
  - HTTP route (api only) → `*.route.ts` (e.g. `snapshot.route.ts`)
  - React hook → `*.hook.ts`
  - React component → `*.component.tsx`
  - Test fixture/mock → `*.mock.ts`
- A CSS file paired with a component keeps the component's plain kebab-case name, with no `.component` suffix
  (`data-status-banner.component.tsx` pairs with `data-status-banner.css`).
- Plain domain value types/interfaces that aren't a "layer" (e.g. `temperature-reading.ts`, `temperature-grid.ts`) keep a bare kebab-case
  name — no suffix required.
- Within `domain/`, stateless calculation/algorithm classes (a color scale, an interpolation routine, a grid generator) live under
  `domain/utils/`, kept separate from the models/validators/state-shape types at the `domain/` root.

## Workspaces

The repo is a two-package workspace, and both packages follow the same layering, dependency injection, and file-role naming suffixes — there
is one architecture to learn. `apps/api` differs from `apps/web` in exactly three ways:

- It runs TypeScript through `@swc-node/register`, which is not a free choice: tsyringe needs `emitDecoratorMetadata`, and the obvious
  modernisations fail — one at parse time, one silently at runtime. See `docs/adr/0004-swc-register-required-by-tsyringe.md` before changing
  the loader, the test command, or the Dockerfile.
- Its test runner is Node's built-in one (`node:test`), not Vitest.
- Its presentation layer is HTTP routes rather than React, and it adds the `*.entity.ts` and `*.route.ts` role suffixes, plus the
  `datasource/db/` layer (`apps/web` only ever has `datasource/http/`).

`apps/api` is one package with two entrypoints — `src/main.ts` serves, `src/sweep-worker.ts` sweeps — and one image. Exactly one process may
make upstream calls, so nothing that calls the weather provider may be moved into the api's request path.

## HTTP calls

- Every data source that needs to make an HTTP call goes through `HttpClientService` (`src/datasource/http/http-client.service.ts` in either
  package) instead of calling `fetch` directly. `HttpClientService` is a thin wrapper around `fetch` that also handles retry-with-backoff on
  HTTP 429 and abort propagation, so every data source gets that behavior for free instead of reimplementing it.
- Its one method, `request<T>(baseUrl, { method, params, signal })`, also assembles the query string from `params` — a data source passes a
  base URL and its params, and never builds a query string or an assembled URL by hand.
- Data-source-specific concerns (batching, response shape, mapping to domain models) stay in the data source itself — `HttpClientService`
  only knows about HTTP, never about any particular API's response format.

## Environment variables

- `apps/web` has **no** environment variables at all, and should not gain any. It calls a relative API path in every environment, so there
  is no base URL to configure and no CORS to set up.
- `apps/api` reads its variables through one typed accessor: never read `process.env` outside `src/core/env.service.ts`. Add a static getter
  to the `Env` class instead, so the rest of the package gets it with autocomplete: `Env.DATABASE_URL`. A new variable also needs an entry
  in `apps/api/.env.example`.
- `apps/api/.env` is read only on the host. Containers get their values from `compose.yaml`. The database connection string necessarily has
  two different values, and the two live in those two separate places on purpose — see `docs/running.md`.
- Values that a use case depends on (Slice size, the Sweep interval) are read from `Env` and built into a plain config value at the
  composition root (`sweep-worker.ts`, for `SweepConfig`), then passed straight into the use case's constructor — so a use case depends on
  the value rather than on where it came from, with no DI token needed for a plain (non-class) value.

## Comments

- Comments explain non-obvious logic — a hidden constraint, a subtle invariant, the reason behind a workaround. They never reference a user
  story, ticket number, functional-requirement ID, or a spec/doc file (e.g. "US3", "FR-012", `research.md`) — that document may be edited or
  deleted later, at which point the comment becomes a dangling, misleading reference. If context from an external doc matters, restate the
  relevant part of it inline instead of pointing at the doc.

## Git hooks

- A pre-commit hook (managed by husky + lint-staged, see `.husky/pre-commit`) runs Prettier on staged files before every commit. It installs
  automatically on `npm install` via the `prepare` script — never bypass it with `--no-verify`.

## Commit messages

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `<type>: <description>` (e.g.
  `fix: authentication error`, `feat: add temperature gradient overlay`). Common types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
- This applies going forward only — past commits are not rewritten.

## Testing

### AAA pattern (Arrange / Act / Assert)

Each `it` should separate the three phases with comments (or equivalent blocks). One action under test per case:

```typescript
it('propagates a rejection from the data source', async () => {
  // Arrange
  const dataSource = createFakeDataSource(async () => {
    throw new Error('Open-Meteo is unavailable')
  })
  const useCase = new FetchSnapshotUseCase(dataSource)

  // Act
  const resultPromise = useCase.execute()

  // Assert
  await expect(resultPromise).rejects.toThrow('Open-Meteo is unavailable')
})
```

- **Arrange:** mocks, fixtures (`tests/fixtures/`), and any input/event setup.
- **Act:** a single call to the use case, hook, or public method under test.
- **Assert:** the output contract (a thrown error, a resolved value, rendered DOM, a `DataFetchStatus.kind`, etc.).

### Using fixtures

Import shared fixtures from `tests/fixtures/` (create the folder the first time a fixture is actually needed — don't add it speculatively).
Prefer spreading to override specific fields instead of duplicating the whole object:

```typescript
import { mockSnapshot } from '../fixtures/snapshot.mock'

const partiallyCoveredSnapshot = {
  ...mockSnapshot,
  coverage: { total: 2664, withData: 1_204 },
}
```

A fixture file gets the `*.mock.ts` suffix, following the same layer-suffix convention as the rest of the codebase (see Naming Conventions
above).

## Agent skills

### Issue tracker

Issues and specs live as committed markdown files under `.scratch/`, one directory per feature. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, used verbatim as label strings in each issue file's `Status:` line. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and one `docs/adr/` at the repo root, covering every package under `apps/`. See `docs/agents/domain.md`.

### Running the stack

`docs/running.md` covers bringing the stack up, migrating, seeding, and running the dev frontend against it. Migrations and the seed are
manual by design: never make a process run either as a side effect of starting.
