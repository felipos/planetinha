# Vento

An interactive 3D globe that visualizes worldwide temperature as a color gradient, built with React, TypeScript, Three.js, and Vite, on top
of a Fastify + Postgres backend that Vento owns.

The browser never contacts a weather provider. A single worker process collects hourly Forecast windows from
[Open-Meteo](https://open-meteo.com/) on a paced schedule and stores them; the frontend asks Vento's own API for one hour's worth of
temperature across the whole Grid. That is what makes whole-planet coverage fit inside the provider's free daily allowance — see
[ADR-0002](docs/adr/0002-backend-is-the-sole-open-meteo-client.md).

## Getting started

**[docs/running.md](docs/running.md)** is the one to follow: bringing the stack up, migrating, seeding, and running the dev frontend against
it, in order. The short version:

```sh
npm install
cp apps/api/.env.example apps/api/.env
docker compose up -d
npm run db:migrate --workspace @vento/api
npm run db:seed --workspace @vento/api
npm run dev --workspace @vento/web
```

The globe starts **empty and fills in over roughly 26 minutes** on a fresh instance, with the Coverage percentage climbing as it goes. That
is expected, and there is deliberately no seeded sample data.

## Workspaces

| Package    | What it is                                                                       |
| ---------- | -------------------------------------------------------------------------------- |
| `apps/web` | The React frontend: the globe, and nothing that knows a weather provider exists. |
| `apps/api` | Fastify + Postgres. Serves the Snapshot endpoint, and sweeps the provider.       |

The api and the worker are two entrypoints of one package and one image, differing only by the script they run.

## Reading further

- [docs/architecture.md](docs/architecture.md) — layers, ports, dependency injection, conventions
- [CONTEXT.md](CONTEXT.md) — the domain vocabulary this codebase is written in
- [docs/adr/](docs/adr/) — the decisions that would otherwise look arbitrary
- [AGENTS.md](AGENTS.md) — the rules an agent working here must follow

## Scripts

```sh
npm run build   # build every workspace
npm run lint    # lint every workspace
npm run test    # test every workspace
```
