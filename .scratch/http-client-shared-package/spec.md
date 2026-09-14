# Extract HttpClientService into a shared package

Status: needs-triage

## Problem Statement

`apps/api/src/datasource/http/http-client.service.ts` and `apps/web/src/datasource/http/http-client.service.ts` are near-duplicates: both
wrap `fetch` with retry-with-backoff on HTTP 429, abort propagation, and query-string assembly behind one
`request<T>(baseUrl, { method, params, signal })` method. The api's version carries one extra thing the web version does not need — an
`HttpObserver` hook so a Sweep can count upstream calls and Rate Limit hits. Any fix to the shared retry/backoff/abort logic has to be made
twice today, and the two copies can silently drift.

## Solution direction (not yet decided)

Move the shared logic into a new workspace package both `apps/api` and `apps/web` depend on, keeping the api-only `HttpObserver` telemetry
hook as an optional extension point rather than forcing it onto `apps/web`.

## Open questions for triage

- Where does the new package live — `packages/http-client` alongside `apps/*`, or something else this repo's workspace layout would prefer?
- `apps/web`'s version uses `window.setTimeout`/`window.clearTimeout`; `apps/api`'s uses the global ones. Does a shared implementation need
  an injected timer, or is this difference small enough to keep two thin wrappers around one shared core?
- Does the extracted package get its own test suite, or do the existing per-package tests (each exercising the same behavior against their
  own consumer) already cover it well enough?
- Is this worth doing before or after `apps/web`'s `HttpClientService` gains real API-key/base-URL configuration needs of its own, if that
  ever happens — extracting too early can guess wrong about the shared surface.
