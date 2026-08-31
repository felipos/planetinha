# 08: Point the frontend at Vento's API

**What to build:** The globe stops talking to any weather provider and asks Vento's own backend for a Snapshot. The viewer sees temperature
sampled every 5° instead of every 10°, and the load takes a couple of seconds rather than dozens of sequential upstream requests.

The existing data source port stays exactly as it is; only its implementation changes. That is the whole point of the port, and it is what
keeps the provider replaceable without touching presentation code.

**The upstream adapter and the mock adapter are both deleted**, along with their tests and their environment variables. The frontend gains
no fallback path to the weather provider, and this is deliberate rather than an oversight — a client-side fallback sounds like resilience
but fires exactly when the backend is unavailable, which is to say on every client simultaneously, recreating the burst that ADR-0002 exists
to prevent. With the mock adapter gone, a fresh checkout shows an empty globe filling in over roughly 26 minutes; that is accepted, and any
future mock belongs on the backend.

The frontend calls a **relative** API path in both environments — proxied by the dev server locally, by the reverse proxy in production. No
API base URL variable and no CORS configuration exist anywhere. A developer runs the frontend on their host against the containerised api
and keeps hot module reloading.

Resolution is read from the response rather than hardcoded, so the backend owns it. The refresh interval drops from 30 minutes to 5, since
the Budget constraint that justified 30 no longer applies to a call against our own API.

The wire types are duplicated by hand on this side with a validator, rather than shared through a package — see the spec's _Out of Scope_.

Interpolation stays in place for now. Removing it is ticket `10`, kept separate on purpose so a rendering regression can be bisected apart
from the data source swap.

**Blocked by:** 04, 01

**Status:** ready-for-agent

- [ ] The globe renders temperature for the whole Earth at 5° Resolution, read from the response rather than from a constant
- [ ] The frontend calls a relative API path in both development and production, with no base URL variable and no CORS configuration
- [ ] The upstream provider adapter, the mock adapter, their tests, and their environment variables are gone, and nothing in the frontend
      names a weather provider
- [ ] The response is validated on arrival, and a malformed response becomes a stated error rather than a broken render
- [ ] A Grid Point with No Data stays distinct from a real temperature of zero all the way to the render
- [ ] The automatic refresh runs every 5 minutes
- [ ] The existing component tests and the use-case integration test cover the swap through the unchanged port — no new test seam is
      introduced
