# 01: Schema-driven env validation at boot

**What to build:** A schema (suggested: `zod`) that declares every environment variable `apps/api` reads — name, type, a short description,
and whether it is required or optional (with its default, if any). Both entrypoints (`src/main.ts` and `src/sweep-worker.ts`) validate
`process.env` against it before doing anything else, and exit with one readable error listing every problem found (not just the first) when
the `.env` does not match.

`Env`'s existing static getters keep being the one place the rest of the package reads configuration from — this ticket validates what feeds
them, it does not change how they are consumed elsewhere in the codebase.

**Status:** ready-for-agent

- [ ] One schema file lists every env var `apps/api` reads today (`DATABASE_URL`, `PORT`, `HOST`, `OPEN_METEO_FORECAST_URL`, `SLICE_SIZE`,
      `SWEEP_WORKER_TICK_INTERVAL_MS`, `SWEEP_WORKER_SWEEP_INTERVAL_MS`), each with its type, description, and required/optional status
- [ ] `main.ts` and `sweep-worker.ts` validate `process.env` against the schema as the first thing they do, before `DiContainer.setup()` or
      anything else
- [ ] A missing required variable, or one of the wrong type, produces a single error message listing every such problem, not only the first
      one found
- [ ] `Env`'s public getters are unchanged in shape — existing call sites (`Env.DATABASE_URL`, etc.) keep working exactly as before
- [ ] `apps/api/.env.example` and the schema's descriptions agree; duplication between prose and schema is avoided or explicitly kept in
      sync
- [ ] New test coverage exercises at least: a fully valid `.env`, a missing required variable, and a variable of the wrong type
