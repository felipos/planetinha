import { injectable } from 'tsyringe'
import { TemperatureInterpolator } from '../domain/utils/interpolation'
import type { SelectedPoint } from '../domain/selected-point'
import type { TemperatureGrid } from '../domain/temperature-grid'

/** Derives a `SelectedPoint` from the current `TemperatureGrid` — holds no state of its own. */
@injectable()
export class SelectPointUseCase {
  execute(grid: TemperatureGrid, latitude: number, longitude: number): SelectedPoint {
    const lookup = TemperatureInterpolator.buildGridLookup(grid)
    const { temperatureCelsius, isInterpolated } = TemperatureInterpolator.interpolateTemperatureAt(
      lookup,
      latitude,
      longitude,
    )
    return { latitude, longitude, temperatureCelsius, isInterpolated }
  }
}
