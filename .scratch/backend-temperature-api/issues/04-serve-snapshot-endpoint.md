# 04: Serve a Snapshot from the temperature endpoint

**What to build:** The resource endpoint the frontend will live on. A caller asks for the current temperature of the whole Earth and gets a
uniform lattice back — every Grid Point of the expanded Grid, with `null` where there is No Data — plus enough context to explain a sparse
answer without guessing.

The response is a genuine contract with the frontend, so it is stated precisely in the spec's _API contract_ section; build that shape. The
parts that are easy to get subtly wrong:

- The endpoint returns **every** Grid Point and never omits one. An absent temperature is `null`, which is not zero.
- Coverage totals **2,664**, not 2,522: the api expands each stored pole Grid Point back across all 72 longitudes so the wire format
  describes a uniform lattice. Pole dedup is a Budget optimisation and must not be visible to the frontend.
- There is no top-level Fetched At. A Snapshot is assembled per hour from whatever Forecasts exist and may contain rows written by different
  Sweeps, so a single response-level fetch time would be a lie. Fetched At is per Forecast.
- Valid At is selected by flooring to the current hour, falling back to the most recent hour that has data.
- Before the first Sweep completes, the endpoint returns success with every temperature `null` and Coverage at zero. An empty Grid is the
  limiting case of partial Coverage, not a distinct error.
- A missing schema or an unseeded Grid is a different failure entirely, already caught by fail-fast at boot in ticket `03`. The api never
  serves in that state.
- No caching headers in this release.
- The wire contract is expressed in the domain's vocabulary, so that reading a response teaches the domain rather than obscuring it.

Tested through the real route by injecting requests into the server instance, backed by a fake repository — the highest seam available, and
the one that would catch a serialization or schema mistake. No database and no network in the test loop.

**Blocked by:** 03

**Status:** ready-for-agent

- [x] The endpoint returns a fully covered Snapshot with every Grid Point present, its Valid At, its Resolution, the Coverage counts, and
      the sweep block
- [x] Each stored pole Grid Point appears at all 72 longitudes in the response, and the Coverage total is 2,664
- [x] A partially covered hour returns `null` for the Grid Points with No Data and a Coverage count that reflects only the ones with a
      temperature
- [x] Before the first Sweep completes, the endpoint returns success with every temperature `null` and Coverage zero — not an error
- [x] An hour with no Forecasts falls back to the most recent hour that has data, and the response reports that hour as its Valid At
- [x] Every Forecast carries its own Fetched At, and no top-level Fetched At exists anywhere in the response
- [x] Every case above is asserted through the real route with a fake repository, with no database and no network
