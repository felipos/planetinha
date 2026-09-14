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
- [x] The api and the worker run from the same image, differing only by entrypoint, on a glibc-based Node base image
- [x] The proxy serves the built frontend and forwards the API path, and the globe loads from a single address with no CORS configuration
- [ ] Scaling the api to several replicas leaves exactly one worker running
- [x] The dev frontend runs on the host against the containerised api with hot module reloading intact
- [x] Migrations and the seed run from the host against the published database port, and no service migrates on start
- [x] Starting the stack against an unmigrated or unseeded database produces an actionable instruction from both the api and the worker

## Comments

Two boxes above are left unticked because they could not be exercised on the machine this was built on, not because anything is known to be
wrong with them. Docker's bridge networking is unavailable there — the running kernel has no `veth` module, so every `docker compose up` and
every default-network `docker build` fails with `operation not supported` — which rules out running the compose stack itself and therefore
`--scale api=3`.

What was verified instead, with the containers on host networking:

- Both images build (`docker build --network host`), and `docker compose config` validates.
- The api and the worker run from the same image with different scripts; the api served `/api/snapshot` and the worker swept the Grid to
  completion against a real Postgres.
- Both fail fast inside a container with the instruction naming the skipped step.
- The proxy image serves the built frontend and forwards the API path, with no CORS headers, and the dev frontend on the host reaches the
  api through it with hot module reloading intact.

The two unticked boxes want a machine with working bridge networking: `docker compose up -d`, then `docker compose up -d --scale api=3` and
confirming `docker compose ps` shows one worker.
