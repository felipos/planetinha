import { injectable } from 'tsyringe'
import { TemperatureInterpolator } from '../domain/utils/interpolation'
import type { SelectedPoint } from '../domain/selected-point'
import type { Snapshot } from '../domain/snapshot'

/** Derives a `SelectedPoint` from the current Snapshot — holds no state of its own. */
@injectable()
export class SelectPointUseCase {
  execute(snapshot: Snapshot, latitude: number, longitude: number): SelectedPoint {
    const lookup = TemperatureInterpolator.buildCellLookup(snapshot)
    const { temperatureCelsius, isInterpolated } = TemperatureInterpolator.interpolateTemperatureAt(
      lookup,
      latitude,
      longitude,
    )
    return { latitude, longitude, temperatureCelsius, isInterpolated }
  }
}
