# 01: Region name on click

**What to build:** When a viewer clicks a point on the globe, show which real-world region that point falls in (e.g. "Curitiba, Paraná,
Brasil") alongside the existing coordinate and Forecast already shown by `PointInspector`.

**Status:** needs-triage — the data-source and granularity questions below need an answer before this is ready to implement.

- [ ] A reverse-geocoding data source is chosen (bundled offline dataset vs. third-party API) and the choice is checked against this
      project's existing bias against live upstream dependencies beyond Open-Meteo
- [ ] A decision is made on what granularity "region" means at this Grid's Resolution, given a single Cell can span a very large area
- [ ] The region name appears in `PointInspector` alongside the existing coordinate/Forecast display, with a sensible fallback when no
      region is found (e.g. open ocean)
- [ ] New test coverage for the lookup itself, plus `PointInspector`'s rendering of the region name
