# 05: Fetch hourly Forecast windows from the upstream provider

**What to build:** The api's one and only door to the upstream weather provider: a port the rest of the backend talks to, and the adapter
behind it that turns a Slice of Grid Points into Forecasts.

Each request asks for an hourly temperature series covering two forecast days, for up to 100 Grid Points at once — see ADR-0001 for the
Budget arithmetic behind that shape. One such request therefore yields 48 hourly Forecasts per Grid Point, which is what makes freshness
stop depending on how often we Sweep. Values are model output: they are Forecasts, never readings or observations, and this holds for the
present hour as much as for future ones.

The api gets its own HTTP client for this, following the web app's convention: a thin wrapper around `fetch` that handles retry-with-backoff
on Rate Limit responses and abort propagation, so every data source gets that behavior for free. Provider-specific concerns — how many Grid
Points go in one call, the response shape, the mapping to domain models — stay in the adapter; the HTTP client knows about HTTP and nothing
else. Environment variables are read through a single typed accessor rather than scattered across the codebase.

The upstream provider has **no pagination**: no cursor, no page, no continuation token. The only axis for splitting a request is the number
of Grid Points per call. Slicing is Vento's own, and it belongs to ticket `06`, not here.

Tested with the HTTP client mocked. This is the seam the sweep tests in `06` cannot reach, because their fake port leaves the provider's
payload shape untested. Prior art for this pattern exists in the web app's upstream adapter test, which ticket `08` deletes; that knowledge
moves here.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] A request for a Slice of Grid Points returns one hourly Forecast series per Grid Point, covering two forecast days
- [ ] Hourly arrays are aligned positionally to the comma-separated coordinates sent, and a Slice of 100 Grid Points maps back to the right
      100 Grid Points in the right order
- [ ] A `null` temperature anywhere in the series maps to No Data and never to zero
- [ ] A provider error body surfaces as a failure with a human-readable message, rather than being parsed as data
- [ ] Rate Limit responses are retried with backoff by the HTTP client, and an abort interrupts both in-flight requests and backoff waits
- [ ] All of the above is covered with the HTTP client mocked — no network in the test loop
- [ ] Every dependency added by this ticket is pinned to an exact version
