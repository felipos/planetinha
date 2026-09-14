import { injectable } from 'tsyringe'
import { CellLocator } from '../utils/cell-locator'
import type { SelectedPoint } from '../models/selected-point'
import type { Snapshot } from '../models/snapshot'

/**
 * Derives a `SelectedPoint` from the current Snapshot — holds no state of its own.
 *
 * The point reported is the containing Cell's Grid Point, not the position clicked: that Grid
 * Point is what the number belongs to, and saying so is more useful than naming a coordinate
 * Planetinha never sampled.
 */
@injectable()
export class SelectPointUseCase {
  execute(snapshot: Snapshot, latitude: number, longitude: number): SelectedPoint | null {
    const lookup = CellLocator.buildLookup(snapshot)
    const cell = CellLocator.cellFor(lookup, latitude, longitude)
    if (cell === null) {
      return null
    }

    return {
      latitude: cell.latitude,
      longitude: cell.longitude,
      temperatureCelsius: CellLocator.findForecast(lookup, latitude, longitude)?.temperatureCelsius ?? null,
    }
  }
}
