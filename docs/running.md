# Running Planetinha

Everything here is done from a fresh checkout, in order. It ends with a working globe.

## Requirements

- Node.js >= 24 (see `.nvmrc`; run `nvm use` if you use nvm)
- Docker with Compose

## 1. Install and configure

```sh
npm install
cp apps/api/.env.example apps/api/.env
cp docker.env.example docker.env
```

`apps/api/.env` is read only by things you run **on the host**: the api and the Sweep Worker when you start them yourself, and the `db:*`
scripts below. `docker.env` is the container counterpart — everything the api and Sweep Worker containers need, referenced by `compose.yaml`
via `env_file` — and nothing in it is a secret, since it is just the fixed dev credentials already visible in `compose.yaml`.

## 2. Bring the stack up

```sh
docker compose up -d
```

That starts Postgres, the api, the Sweep Worker, and a reverse proxy serving the built frontend on <http://localhost:8080>.

On a database that has not been migrated and seeded yet, the api and the Sweep Worker **exit immediately** and say which step is missing.
That is by design, not a failure — see the next section — and `docker compose up -d` will restart them automatically once you have run it.

## 3. Migrate and seed — manual by design

```sh
npm run db:migrate --workspace @planetinha/api
npm run db:seed --workspace @planetinha/api
```

**No process migrates or seeds as a side effect of starting.** A schema change is a decision, and a process that quietly applies one on boot
makes a rollback into a guess. So both steps are run explicitly by a human or an agent, from the host, against the port compose publishes.

The migration creates the Grid Point, Forecast, and Sweep tables. The seed materialises the Grid: 2,522 Grid Points at 5° Resolution.
Re-running the seed is safe — it conflicts and does nothing, so Grid Point ids never move, which matters because a Sweep's cursor refers to
them.

If you skipped a step, the api and the Sweep Worker tell you which:

```
The database schema is missing. Run `npm run db:migrate --workspace @planetinha/api` from the host
before starting this process.
```

## 4. The two connection strings

There are necessarily two, and they are kept in separate places so neither context can read the other's:

| Who reads it                                           | Where it lives  | Value                                                        |
| ------------------------------------------------------ | --------------- | ------------------------------------------------------------ |
| Host tooling — `db:migrate`, `db:seed`, a host-run api | `apps/api/.env` | `postgres://planetinha:planetinha@localhost:5432/planetinha` |
| The api and Sweep Worker containers                    | `docker.env`    | `postgres://planetinha:planetinha@postgres:5432/planetinha`  |

They differ in one word — `localhost` versus `postgres` — because a container reaches Postgres by service name on the compose network, while
your shell reaches it on the port compose publishes. This is the step most likely to be got wrong silently: a container handed the host's
string cannot resolve `localhost` to Postgres, and host tooling handed the container's string cannot resolve `postgres` at all.

## 5. Run the dev frontend against the containerised api

The dev frontend is deliberately **not** containerised, so hot module reloading keeps working:

```sh
npm run dev --workspace @planetinha/web
```

It serves on <http://localhost:5173> and forwards `/api` to the stack on port 8080. The frontend calls a relative path in every environment
— the dev server proxies it here, the reverse proxy does in production — so there is no API base URL variable and no CORS configuration
anywhere.

## What a freshly deployed instance looks like

**The globe starts empty and fills in over roughly 26 minutes.** This is expected, and the app says so: the banner reads "Carga inicial dos
dados: N% do globo preenchido", and the percentage climbs on each refresh. Coverage comes from the api's own counts, so it reflects the Grid
rather than a guess.

The arithmetic behind the wait: the Grid is 2,522 Grid Points, a Slice is 100 of them, and the Sweep Worker advances one Slice per 60-second
Tick — so 26 Ticks, about 26 minutes. After that the globe is fully covered, and Sweeps run twice a day to correct the Forecasts.

**There is no seeded sample data, on purpose.** The frontend's mock adapter was deleted along with its path to any weather provider, because
a client-side fallback fires exactly when the backend is unavailable — on every open tab at once — which is the burst this whole design
exists to prevent. Any future mock belongs on the backend.

Note that every `docker compose up` runs a Sweep Worker. Several developers running the stack at the same time compete for one daily
allowance; that is accepted for now, and worth knowing before two people leave the stack up overnight.

## For an operator: checking the Budget assumption

Each Sweep records what it spent, in the `sweeps` table:

```sh
docker compose exec postgres psql -U planetinha -d planetinha -c \
  "SELECT id, status, started_at, completed_at, fetched_grid_point_count, failed_grid_point_count,
          upstream_calls_made, rate_limit_hits, last_error
     FROM sweeps ORDER BY id DESC LIMIT 5;"
```

`upstream_calls_made` counts HTTP requests issued, retries included; `rate_limit_hits` counts HTTP 429 responses. Every Rate Limit response
is also logged by the Sweep Worker alongside the Slice that triggered it (`docker compose logs sweep-worker`).

These exist for one reason. **The provider does not document how it weights a multi-location call**, and the Budget arithmetic in
[ADR-0001](adr/0001-fetch-hourly-forecast-windows.md) assumes roughly one call per Grid Point — two Sweeps a day costing about 5,000 of a
10,000/day allowance. That assumption is checkable rather than trustworthy: if reality proves harsher, either the Resolution or the Sweep
frequency has to come down. `SLICE_SIZE`, `SWEEP_WORKER_TICK_INTERVAL_MS`, and `SWEEP_WORKER_SWEEP_INTERVAL_MS` are the knobs, all
configuration rather than constants.

## Other commands

```sh
npm run build   # build every workspace
npm run lint    # lint every workspace
npm run test    # test every workspace

npm run db:generate --workspace @planetinha/api  # regenerate migration SQL after a schema change
npm run start --workspace @planetinha/api        # run the api on the host instead of in a container
npm run worker:sweep --workspace @planetinha/api # run the Sweep Worker on the host
```
