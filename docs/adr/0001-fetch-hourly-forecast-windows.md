# Fetch hourly forecast windows, not current-instant values

Planetinha displays one hour of temperature at a time, but each Sweep requests `hourly=temperature_2m&forecast_days=2` and stores all 48
hourly values per Grid Point. This looks like waste until you see the arithmetic: Open-Meteo weights a call by the number of locations
requested, so a whole-planet refresh of instantaneous values must re-sweep constantly to stay current, while a forecast window makes one
Sweep feed two days of display. The free tier allows 10,000 calls/day; the old approach (684 points, refreshed every 30 minutes) needed
roughly 33,000, which is why the application was producing HTTP 429s and incomplete grids.

## Consequences

- At 5° Resolution the Grid holds 2,522 points, so two Sweeps per day cost ~5,000 calls — about half the daily Budget, leaving real headroom
  for retries and a second environment.
- Freshness stops being a function of Sweep frequency. Sweeps exist to _correct_ forecasts, not to discover the present, so a late or failed
  Sweep degrades accuracy rather than availability.
- **2.5° Resolution is impossible on the free tier.** It needs 10,512 points, over the entire daily Budget for a single Sweep. Nothing in
  the code will ever show this; 5° is a ceiling imposed from outside.
- The stored hourly series is what would make temporal animation possible later at zero additional API cost. That is not built, but the data
  for it accumulates anyway.
- Open-Meteo's exact weighting for multi-location requests is not documented. The `temperature_sweeps` table records `api_calls_made` and
  `rate_limit_hits` per Sweep specifically so this assumption can be checked against reality rather than trusted.
