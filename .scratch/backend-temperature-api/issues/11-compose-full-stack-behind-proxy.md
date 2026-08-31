# 11: Bring the whole stack up with one compose command

**What to build:** Onboarding stops requiring a runbook. A single compose command starts Postgres, the api, the worker, and a reverse proxy
serving the built frontend, and the globe is reachable on one address with no environment-specific configuration.

Ticket `03` already brought up Postgres; this ticket adds the other three services around it.

The api and the worker run **from the same image with different entrypoints**, so there is one build artifact to reason about. They use a
glibc-based Node base image, because the TypeScript loader ships native binaries and a musl mismatch is expensive to diagnose from inside a
container — this is a deliberate choice, not an accident of whichever tag was handy. The proxy image has no native dependencies.

The reverse proxy serves the built frontend and forwards the API path, which is what makes the frontend's relative path work in production
the same way the dev server's proxy makes it work locally. No CORS configuration exists anywhere in the stack.

The dev frontend is **not** containerised. A developer runs it on their host against the containerised api so hot module reloading still
works.

Migrations and the seed are still run manually from the host against the published database port — no service migrates as a side effect of
starting. Both the api and the worker fail fast at boot when the schema or the Grid seed is missing, so a forgotten step produces an
instruction rather than a stack trace.

Note that every compose start runs the worker, so several developers running the stack simultaneously compete for one Budget. That is
accepted for now, and is worth knowing before two people leave the stack up overnight.

**Blocked by:** 07, 09, 10

**Status:** ready-for-agent

- [ ] One compose command brings up Postgres, the api, the worker, and the reverse proxy
- [ ] The api and the worker run from the same image, differing only by entrypoint, on a glibc-based Node base image
- [ ] The proxy serves the built frontend and forwards the API path, and the globe loads from a single address with no CORS configuration
- [ ] Scaling the api to several replicas leaves exactly one worker running
- [ ] The dev frontend runs on the host against the containerised api with hot module reloading intact
- [ ] Migrations and the seed run from the host against the published database port, and no service migrates on start
- [ ] Starting the stack against an unmigrated or unseeded database produces an actionable instruction from both the api and the worker
