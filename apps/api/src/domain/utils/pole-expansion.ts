import { GridEnumerator } from './grid-enumeration'
import { GRID_RESOLUTION_DEGREES } from '../../core/config'

/**
 * Undoes the Budget optimisation `GridEnumerator` applies at the poles: a pole is stored once,
 * but named by every longitude column on the wire, so a caller never has to know it was
 * deduplicated. Kept apart from `SnapshotAssembler` so this specific optimisation — and the
 * saving it buys — has a name and a place of its own rather than living unlabeled inside a
 * bigger assembly step.
 */
export class PoleExpansion {
  /** How many Grid Points the wire format describes, with each pole expanded back out. */
  static count(): number {
    const latitudeRows = Math.round(180 / GRID_RESOLUTION_DEGREES) + 1
    const longitudeColumns = Math.round(360 / GRID_RESOLUTION_DEGREES)
    return latitudeRows * longitudeColumns
  }

  /** Whether a latitude is a pole — the one case a stored Grid Point stands for more than itself. */
  static isPole(latitude: number): boolean {
    return latitude === -90 || latitude === 90
  }

  /** The pole's single stored point, restated once per longitude column. */
  static expand<T extends { readonly longitude: number }>(pole: T): readonly T[] {
    const longitudeColumns = Math.round(360 / GRID_RESOLUTION_DEGREES)
    return Array.from({ length: longitudeColumns }, (_unused, column) => ({
      ...pole,
      longitude: GridEnumerator.roundCoordinate(-180 + column * GRID_RESOLUTION_DEGREES),
    }))
  }
}
