# 02: Scaffold the api package with a health endpoint

**What to build:** A second workspace package alongside the web app, running a Fastify server whose only route is a health endpoint. An
operator can start it and get an answer; a container health check can hit it every few seconds without it touching a Snapshot, a database,
or the upstream provider.

This is the tracer bullet for the whole backend: it establishes the package, its toolchain, its layering, and the test seam every later
backend ticket writes against. Nothing here knows about temperature yet.

The package follows the same layering, dependency injection, and file-role naming suffixes as the web app, so there is one architecture to
learn across the repo. Dependency injection uses the same container, which requires decorator metadata emission — see ADR-0004 for why the
loader choice is not free, and what fails at runtime rather than at build time if it is got wrong. The test runner is Node's built-in one.
New dependencies are pinned exactly, per the repo's conventions.

The test seam this ticket establishes: build the server instance in-process and inject requests into it, asserting on the real route's real
response. No network, no database, no listening port.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The api package builds, lints, and tests through the repo's task runner alongside the web package
- [ ] The health endpoint answers successfully without reading any Snapshot, Forecast, or Grid Point
- [ ] A test injects a request into the server instance in-process and asserts the health response — no port is bound, no network is reached
- [ ] A class resolved from the container with a concrete-class constructor dependency resolves correctly at runtime, in both the test
      command and the start command — this is the failure ADR-0004 exists to prevent, and it does not surface at build time
- [ ] Every dependency added by this ticket is pinned to an exact version
