/**
 * The Cell a viewer tapped or clicked, reported by its own Grid Point's real coordinates rather
 * than by the arbitrary position under the cursor. Derived on demand from a Snapshot — not
 * persisted state.
 *
 * There is no "is this value interpolated?" flag, because nothing is interpolated: the value
 * shown is the one fetched for this Grid Point, or No Data.
 */
export interface SelectedPoint {
  readonly latitude: number
  readonly longitude: number
  readonly temperatureCelsius: number | null
}
