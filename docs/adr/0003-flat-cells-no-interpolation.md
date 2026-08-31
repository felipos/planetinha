# The globe renders flat Cells and never interpolates

Each Grid Point colours its own Cell as a flat block, and the globe blends nothing between neighbours. This produces a visibly blocky 72×37
patchwork, and it replaced a working inverse-distance-weighting implementation that looked considerably smoother. The blockiness is the
intended result, not an unfinished feature.

## Consequences

- The globe shows exactly the values Vento fetched, and nothing it invented. A Grid Point with No Data reads as a genuine hole instead of
  being smeared over by whatever its neighbours happened to report.
- Clicking the globe reports the containing Cell's Grid Point and names its real coordinates, rather than synthesising a value for the
  arbitrary point under the cursor. `SelectedPoint.isInterpolated` no longer exists because the question it answered cannot arise.
- `TemperatureInterpolator` shrank to a Cell locator: coordinate rounding, longitude wrapping, and key lookup. The IDW routine and its tests
  were removed.
- If smoothing is ever wanted back, it belongs in the backend, which holds the whole Grid and can precompute — not in a per-texel loop in
  the browser.
