# AI agents guidelines

- Everything on the project should always be written in english (code, comments, documentation, etc) unless explicit said.

- All dependencies should have its versions fixed. No ^ or ~ caracters. This avoids security problems.

- Every new code should have its respective test cases.

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
- A dependency typed as an interface (a port) needs an injection token, since interfaces have no runtime representation — see
  `src/application/tokens.ts`. A dependency typed as a concrete class needs no token; tsyringe can resolve it directly.
- All container registration happens in one place: `src/di-container.ts`. No other file should call `container.register*`.
- The composition root (`src/main.tsx`) is the only file that calls `container.resolve()`. It resolves the use cases the app needs and
  passes them down as props — components and hooks receive their use case as a parameter, they never resolve one themselves. This keeps
  components/hooks trivially testable with a fake use case, with no container involved in tests.

## Naming conventions

- Directories and files are `kebab-case`. No `PascalCase` or `camelCase` filenames or directory names anywhere in the project
  (`data-status-banner/`, not `DataStatusBanner/`).
- A file that plays a specific architectural role carries a suffix naming that role:
  - Use case → `*.use-case.ts` (e.g. `fetch-temperature-grid.use-case.ts`)
  - Data source → `*.data-source.ts` (e.g. `open-meteo-temperature.data-source.ts`)
  - Port (interface) → `*.port.ts`
  - Service → `*.service.ts` (e.g. `http-client.service.ts`, `env.service.ts`)
  - Validator → `*.validator.ts`
  - React hook → `*.hook.ts`
  - React component → `*.component.tsx`
  - Test fixture → `*.fixture.ts`
- A CSS file paired with a component keeps the component's plain kebab-case name, with no `.component` suffix
  (`data-status-banner.component.tsx` pairs with `data-status-banner.css`).
- Plain domain value types/interfaces that aren't a "layer" (e.g. `temperature-reading.ts`, `temperature-grid.ts`) keep a bare kebab-case
  name — no suffix required.
- Within `domain/`, stateless calculation/algorithm classes (a color scale, an interpolation routine, a grid generator) live under
  `domain/utils/`, kept separate from the models/validators/state-shape types at the `domain/` root.

## HTTP calls

- Every data source that needs to make an HTTP call goes through `HttpClient` (`src/infrastructure/http-client.service.ts`) instead of
  calling `fetch` directly. `HttpClient` is a thin wrapper around `fetch` that also handles retry-with-backoff on HTTP 429 and abort
  propagation, so every data source gets that behavior for free instead of reimplementing it.
- Data-source-specific concerns (batching, response shape, mapping to domain models) stay in the data source itself — `HttpClient` only
  knows about HTTP, never about any particular API's response format.

## Environment variables

- Environment variables live in `.env` (git-ignored; see `.env.example` for the required keys). Vite only exposes vars prefixed `VITE_` to
  client code, so every var meant to be read at runtime must use that prefix in `.env` (e.g. `VITE_OPEN_METEO_FORECAST_URL`).
- Never read `import.meta.env` directly outside `src/infrastructure/env.service.ts`. Add a typed static getter to the `Env` class for every
  variable instead, so the rest of the codebase gets it with autocomplete: `Env.OPEN_METEO_FORECAST_URL`. The getter's name drops the
  `VITE_` prefix — that prefix is a Vite implementation detail the rest of the app shouldn't need to know about.
- New variables also need a matching entry in `src/vite-env.d.ts` (for typing) and `.env.example` (for onboarding).

## Comments

- Comments explain non-obvious logic — a hidden constraint, a subtle invariant, the reason behind a workaround. They never reference a user
  story, ticket number, functional-requirement ID, or a spec/doc file (e.g. "US3", "FR-012", `research.md`) — that document may be edited or
  deleted later, at which point the comment becomes a dangling, misleading reference. If context from an external doc matters, restate the
  relevant part of it inline instead of pointing at the doc.

## Git hooks

- A pre-commit hook (managed by husky + lint-staged, see `.husky/pre-commit`) runs Prettier on staged files before every commit. It installs
  automatically on `npm install` via the `prepare` script — never bypass it with `--no-verify`.

## Testing

### AAA pattern (Arrange / Act / Assert)

Each `it` should separate the three phases with comments (or equivalent blocks). One action under test per case:

```typescript
it('propagates a rejection from the data source', async () => {
  // Arrange
  const dataSource = createFakeDataSource(async () => {
    throw new Error('Open-Meteo indisponível')
  })
  const useCase = new FetchTemperatureGridUseCase(dataSource)

  // Act
  const resultPromise = useCase.execute()

  // Assert
  await expect(resultPromise).rejects.toThrow('Open-Meteo indisponível')
})
```

- **Arrange:** mocks, fixtures (`tests/fixtures/`), and any input/event setup.
- **Act:** a single call to the use case, hook, or public method under test.
- **Assert:** the output contract (a thrown error, a resolved value, rendered DOM, a `DataFetchStatus.kind`, etc.).

### Using fixtures

Import shared fixtures from `tests/fixtures/` (create the folder the first time a fixture is actually needed — don't add it speculatively).
Prefer spreading to override specific fields instead of duplicating the whole object:

```typescript
import { mockTemperatureGrid } from '../fixtures/temperature-grid.fixture'

const partiallyCoveredGrid = {
  ...mockTemperatureGrid,
  expectedPointCount: 100,
}
```

A fixture file gets the `*.fixture.ts` suffix, following the same layer-suffix convention as the rest of the codebase (see Naming
Conventions above).
