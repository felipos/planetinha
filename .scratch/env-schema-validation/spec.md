# Validate environment variables against a schema at boot

Status: ready-for-agent

## Problem Statement

`apps/api/src/core/env.service.ts` reads `process.env` through ad hoc `Env.required(key)` / `Env.optionalNumber(key, fallback)` calls, one
per getter. There is no single place that declares every environment variable the api uses — its type, whether it is required or optional,
its default, and what it is for. A malformed or incomplete `.env` is only discovered lazily, whichever getter happens to be touched first at
runtime, with an error naming that one variable rather than every problem with the configuration.

## Solution

Declare a schema listing every environment variable Planetinha's api reads: name, type, description, required/optional, and default where
one applies. Validate `process.env` against that schema once, at the very start of both entrypoints (`main.ts` and `sweep-worker.ts`), and
fail fast with one readable error that lists every variable that is missing or the wrong type — not just the first one encountered.

`Env`'s existing getters (`Env.DATABASE_URL`, etc.) should keep being the one place the rest of the package reads configuration from; this
is about validating the input to that class up front, not about changing how the rest of the codebase consumes it.

## Notes

- No library is chosen yet. `zod` is a reasonable default (nothing else in the project pulls in a schema-validation library today), but
  confirm before adding a new dependency.
- `apps/api/.env.example` already documents every variable in prose; the schema's descriptions should replace or mirror that, not duplicate
  it out of sync.
