import { injectable } from 'tsyringe'
import { AbortErrorDetector } from '../../domain/utils/abort-error'
import { GridPointsGenerator, type GridPoint } from '../../domain/utils/grid-points'
import type { Snapshot } from '../../domain/snapshot'
import type { Forecast } from '../../domain/forecast'
import type {
  SnapshotDataSourcePort,
  SnapshotRequest,
} from '../../application/ports/snapshot-data-source.port'
import { Env } from '../env.service'
import { HttpClient } from '../http-client.service'

/**
 * Concrete `SnapshotDataSourcePort` implementation for the Open-Meteo public API.
 */

// No documented fixed ceiling on coordinate count; the real observed limit is URL length (HTTP
// 414 somewhere between 200 and 500 coordinates). 100 keeps a comfortable safety margin.
const BATCH_SIZE = 100

// Minimum spacing between firing two consecutive batches. Open-Meteo enforces an undocumented
// per-minute burst limit — fetching sequentially already helps, but on fast connections the
// batches of a full grid can still fire almost back-to-back; this delay guarantees real spacing
// between requests, not just the previous one's network time.
const BATCH_THROTTLE_MS = 1_200

interface OpenMeteoCurrentBlock {
  readonly time?: string
  readonly temperature_2m?: number | null
}

interface OpenMeteoLocationResponse {
  readonly current?: OpenMeteoCurrentBlock
}

interface OpenMeteoErrorResponse {
  readonly error?: boolean
  readonly reason?: unknown
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function buildRequestUrl(points: readonly GridPoint[]): string {
  const latitude = points.map((point) => point.latitude).join(',')
  const longitude = points.map((point) => point.longitude).join(',')
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: 'temperature_2m',
    temperature_unit: 'celsius',
    timeformat: 'iso8601',
  })
  return `${Env.OPEN_METEO_FORECAST_URL}?${params.toString()}`
}

function isErrorResponse(body: unknown): body is OpenMeteoErrorResponse {
  return typeof body === 'object' && body !== null && (body as OpenMeteoErrorResponse).error === true
}

/** `sleep` that respects `signal`: aborts the wait itself (rather than only discarding the result later). */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
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
export class OpenMeteoTemperatureDataSource implements SnapshotDataSourcePort {
  constructor(private readonly httpClient: HttpClient) {}

  async fetchSnapshot(request: SnapshotRequest, signal?: AbortSignal): Promise<Snapshot> {
    const points = GridPointsGenerator.generate(request.resolutionDegrees)
    const batches = chunk(points, BATCH_SIZE)

    // Sequential, not Promise.all: firing every batch in parallel can trip Open-Meteo's
    // short-burst rate limit (HTTP 429). A minimum delay (BATCH_THROTTLE_MS) is also applied
    // between batches, and each batch that still gets a 429 is retried with exponential backoff
    // (via HttpClient) before giving up.
    //
    // A batch that exhausts its retries does NOT bring down the whole fetch: it's skipped (its
    // Grid Points are left out of `forecasts`, showing up as No Data on the globe) and the
    // remaining batches keep going — only if EVERY batch fails (no Forecast obtained at all)
    // does the whole fetch reject.
    const forecasts: Forecast[] = []
    let lastError: unknown
    for (let i = 0; i < batches.length; i += 1) {
      if (i > 0) {
        await sleep(BATCH_THROTTLE_MS, signal)
      }
      const batch = batches[i]
      if (batch === undefined) {
        continue
      }
      try {
        const batchForecasts = await this.fetchBatch(batch, signal)
        forecasts.push(...batchForecasts)
      } catch (error) {
        if (AbortErrorDetector.isAbortError(error)) {
          throw error
        }
        lastError = error
      }
    }

    if (forecasts.length === 0 && batches.length > 0) {
      throw lastError instanceof Error
        ? lastError
        : new Error('Falha desconhecida ao buscar a grade de temperatura.')
    }

    return {
      forecasts,
      fetchedAt: new Date().toISOString(),
      resolutionDegrees: request.resolutionDegrees,
      expectedPointCount: points.length,
    }
  }

  private async fetchBatch(points: readonly GridPoint[], signal?: AbortSignal): Promise<Forecast[]> {
    const body = await this.httpClient.getJson<unknown>(buildRequestUrl(points), { signal })

    if (isErrorResponse(body)) {
      throw new Error(`A API de temperatura retornou um erro: ${String(body.reason ?? 'desconhecido')}`)
    }

    const items: readonly OpenMeteoLocationResponse[] = Array.isArray(body)
      ? (body as OpenMeteoLocationResponse[])
      : [body as OpenMeteoLocationResponse]

    return points.map((point, index) => {
      const item = items[index]
      const temperature = item?.current?.temperature_2m
      const validAt = item?.current?.time ?? new Date().toISOString()
      return {
        latitude: point.latitude,
        longitude: point.longitude,
        temperatureCelsius: typeof temperature === 'number' ? temperature : null,
        validAt,
      }
    })
  }
}
