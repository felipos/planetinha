# 10: Render flat Cells and stop interpolating

**What to build:** Each Cell shows exactly the Forecast that was fetched for its Grid Point, as a flat block, and the globe blends nothing
between neighbours. The viewer is never shown a value the system invented.

The result is a visibly blocky 72×37 patchwork, replacing a working inverse-distance-weighting implementation that looked considerably
smoother. **The blockiness is the intended result, not an unfinished feature** — see ADR-0003. A Grid Point with No Data now reads as a
genuine hole instead of being smeared over by whatever its neighbours happened to report, which is the whole reason the trade is worth
making.

Clicking anywhere on the globe reports the containing Cell's Grid Point and its real coordinates, rather than synthesising a value for the
arbitrary point under the cursor. The "is this value interpolated?" flag ceases to exist, on the model and in the inspector alike, because
the question it answered cannot arise.

The interpolator shrinks to a Cell locator: coordinate rounding, longitude wrapping, key lookup. The IDW routine goes, and its tests go with
it; the tests for the surviving coordinate helpers stay.

The poles render like every other part of the globe — the api already expands them across all 72 longitudes — so there is no permanent hole
at the top and bottom.

If smoothing is ever wanted back, it belongs in the backend, which holds the whole Grid and can precompute; not in a per-texel loop in the
browser.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] Every Cell renders its own Grid Point's Forecast as a flat block, with no blending between neighbours
- [ ] A Cell with No Data is visibly distinct from a cold Cell and shows no scale colour at all
- [ ] Clicking the globe reports the containing Cell's Grid Point and its real coordinates
- [ ] The interpolated flag is gone from the selected-point model and from the inspector
- [ ] The poles render like everywhere else, with no hole at the top or bottom of the globe
- [ ] The interpolator is reduced to coordinate rounding, longitude wrapping, and key lookup — the IDW routine and its tests are deleted,
      and the coordinate-helper tests still pass
