# Show the region name for a clicked point on the globe

Status: needs-triage

## Problem Statement

Clicking a point on the globe today shows only the containing Cell's coordinates and Forecast (`PointInspector`, backed by `CellLocator`) —
no indication of what real-world place that Cell covers. A viewer sees a latitude/longitude pair and a temperature, with no geographic
anchor.

## Solution direction (not yet decided)

Add a lookup that, given a clicked position, returns the region it falls in (e.g. "Curitiba, Paraná, Brasil"), and show it alongside the
existing coordinate/Forecast display in the point inspector.

## Open questions for triage

- Data source: an offline dataset bundled with the app (consistent with this project's existing bias against extra live upstream
  dependencies — see `docs/adr/0002-backend-is-the-sole-open-meteo-client.md`), versus a third-party reverse-geocoding API.
- Granularity: a Grid Point at 5° Resolution is centred on a Cell that can span hundreds of kilometers — "the region" for a single click may
  need to be an area name (a country or state) rather than a city, or the click position (not just the Cell's Grid Point) may need to drive
  the lookup even though the Forecast itself is per-Cell.
- Where this lives: purely `apps/web` (a bundled dataset, looked up client-side), or does it need backend support of some kind.
