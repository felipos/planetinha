import type {
  FetchForecastsOptions,
  FetchedForecast,
  FetchedForecastWindow,
  ForecastSourcePort,
} from '../../src/application/ports/forecast-source.port'
import type { StoredGridPoint } from '../../src/domain/grid-point'
import type { LogFields, LoggerPort } from '../../src/application/ports/logger.port'

export interface FakeForecastSourceOptions {
  /** Hours per Grid Point in the window the fake returns. Two forecast days is 48. */
  readonly hoursInWindow?: number
  readonly fetchedAt?: Date
  readonly temperature?: (gridPoint: StoredGridPoint, hour: number) => number | null
  /** Fails every call with this message, standing in for an unhappy provider. */
  readonly failWith?: string
  readonly upstreamCallsPerFetch?: number
  readonly rateLimitsPerFetch?: number
}

export const WINDOW_START = new Date('2026-08-31T00:00:00.000Z')

/** A `ForecastSourcePort` that answers from arithmetic instead of from the network. */
export function createFakeForecastSource(options: FakeForecastSourceOptions = {}): ForecastSourcePort {
  const hoursInWindow = options.hoursInWindow ?? 48
  const fetchedAt = options.fetchedAt ?? new Date('2026-08-31T09:15:00.000Z')
  const temperature = options.temperature ?? (() => 10)

  return {
    async fetchForecastWindow(
      gridPoints: readonly StoredGridPoint[],
      fetchOptions?: FetchForecastsOptions,
    ): Promise<FetchedForecastWindow> {
      for (let call = 0; call < (options.upstreamCallsPerFetch ?? 1); call += 1) {
        fetchOptions?.onUpstreamCall?.()
      }
      for (let hit = 0; hit < (options.rateLimitsPerFetch ?? 0); hit += 1) {
        fetchOptions?.onRateLimited?.()
      }

      if (options.failWith !== undefined) {
        throw new Error(options.failWith)
      }

      const forecasts: FetchedForecast[] = []
      for (const gridPoint of gridPoints) {
        for (let hour = 0; hour < hoursInWindow; hour += 1) {
          forecasts.push({
            gridPointId: gridPoint.id,
            validAt: new Date(WINDOW_START.getTime() + hour * 3_600_000),
            temperatureCelsius: temperature(gridPoint, hour),
          })
        }
      }

      return { forecasts, fetchedAt }
    },
  }
}

export interface RecordedLog {
  readonly level: 'info' | 'warn' | 'error'
  readonly message: string
  readonly fields: LogFields
}

/** A `LoggerPort` that keeps its lines so a test can assert one was written. */
export function createRecordingLogger(): LoggerPort & { readonly lines: RecordedLog[] } {
  const lines: RecordedLog[] = []
  return {
    lines,
    info: (message, fields) => lines.push({ level: 'info', message, fields: fields ?? {} }),
    warn: (message, fields) => lines.push({ level: 'warn', message, fields: fields ?? {} }),
    error: (message, fields) => lines.push({ level: 'error', message, fields: fields ?? {} }),
  }
}
