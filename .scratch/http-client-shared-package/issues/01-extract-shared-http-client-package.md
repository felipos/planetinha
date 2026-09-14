# 01: Extract HttpClientService into a shared package

**What to build:** A single `HttpClientService` implementation used by both `apps/api` and `apps/web`, replacing the two near-duplicate
copies that exist today, to stop the shared retry/backoff/abort/query-building logic from being able to drift between packages.

**Status:** needs-triage — the workspace-layout and API-shape questions below need an answer before this is ready to implement.

- [ ] Decide where the shared package lives in the workspace
- [ ] Decide how to keep the api-only `HttpObserver` telemetry hook available to `apps/api` without forcing it into `apps/web`'s usage
- [ ] Decide whether the `window.setTimeout` (web) vs global `setTimeout` (api) difference needs an injected timer abstraction or is fine
      left as a thin per-package wrapper
- [ ] Both packages' existing HTTP-layer tests still pass unmodified in behavior (only their import path changes)
- [ ] `AGENTS.md`'s "HTTP calls" section is updated to point at the new package location
