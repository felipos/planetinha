import { injectable } from 'tsyringe'
import { GridPointsGenerator } from '../../domain/utils/grid-points'
import type { TemperatureGrid } from '../../domain/temperature-grid'
import type { TemperatureReading } from '../../domain/temperature-reading'
import type {
  TemperatureDataSourcePort,
  TemperatureGridRequest,
} from '../../application/ports/temperature-data-source.port'

/**
 * `TemperatureDataSourcePort` implementation that generates synthetic data locally, with no
 * network calls at all. Used by `npm run dev:mock` to develop/validate the UI without consuming
 * the public API's free quota.
 *
 * The synthetic temperature follows a simple latitudinal gradient (warmer at the equator,
 * colder at the poles) plus a small per-point and time-based variation, just so successive
 * refreshes produce visibly different values.
 */

const EQUATOR_TEMPERATURE_C = 30
const POLE_TEMPERATURE_C = -25
const NOISE_AMPLITUDE_C = 4
const SIMULATED_LATENCY_MS = 200

function syntheticTemperature(latitude: number, longitude: number, time: number): number {
  const latitudeFactor = Math.cos((latitude * Math.PI) / 180)
  const base = POLE_TEMPERATURE_C + (EQUATOR_TEMPERATURE_C - POLE_TEMPERATURE_C) * latitudeFactor
  const noise = NOISE_AMPLITUDE_C * Math.sin(longitude * 0.15 + latitude * 0.1 + time / (5 * 60 * 1000))
  return Math.round((base + noise) * 10) / 10
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const timeoutId = window.setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeoutId)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

@injectable()
export class MockTemperatureDataSource implements TemperatureDataSourcePort {
  async fetchGrid(request: TemperatureGridRequest, signal?: AbortSignal): Promise<TemperatureGrid> {
    await delay(SIMULATED_LATENCY_MS, signal)

    const points = GridPointsGenerator.generate(request.resolutionDegrees)
    const now = Date.now()
    const observedAt = new Date(now).toISOString()

    const readings: TemperatureReading[] = points.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      temperatureCelsius: syntheticTemperature(point.latitude, point.longitude, now),
      observedAt,
    }))

    return {
      readings,
      fetchedAt: observedAt,
      resolutionDegrees: request.resolutionDegrees,
      expectedPointCount: points.length,
    }
  }
}
