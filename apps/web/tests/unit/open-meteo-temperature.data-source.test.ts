import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AbortErrorDetector } from '../../src/domain/utils/abort-error'
import { HttpClient } from '../../src/infrastructure/http-client.service'
import { OpenMeteoTemperatureDataSource } from '../../src/infrastructure/open-meteo/open-meteo-temperature.data-source'

function jsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }): Response {
  const status = init?.status ?? 200
  const headers = init?.headers ?? {}
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    json: async () => body,
  } as unknown as Response
}

/** Generates a success response with one reading per coordinate in the URL, regardless of batch. */
function successFetch(): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string | URL) => {
    const parsed = new URL(url)
    const points = parsed.searchParams.get('latitude')?.split(',') ?? []
    return jsonResponse(points.map(() => ({ current: { temperature_2m: 15, time: '2026-01-01T00:00' } })))
  })
}

function createDataSource(): OpenMeteoTemperatureDataSource {
  return new OpenMeteoTemperatureDataSource(new HttpClient())
}

describe('OpenMeteoTemperatureDataSource', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('retries a 429 respecting Retry-After and succeeds without surfacing an error', async () => {
    let callCount = 0
    const fetchMock = vi.fn(async (url: string | URL) => {
      callCount += 1
      if (callCount === 1) {
        return jsonResponse(null, { status: 429, headers: { 'Retry-After': '3' } })
      }
      const parsed = new URL(url)
      const points = parsed.searchParams.get('latitude')?.split(',') ?? []
      return jsonResponse(points.map(() => ({ current: { temperature_2m: 21, time: '2026-01-01T00:00' } })))
    })
    vi.stubGlobal('fetch', fetchMock)

    const dataSource = createDataSource()
    // resolutionDegrees=180 -> only 4 points -> 1 batch, isolates the retry behavior.
    const promise = dataSource.fetchGrid({ resolutionDegrees: 180 })
    await vi.advanceTimersByTimeAsync(3_000)
    const grid = await promise

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(grid.readings.every((reading) => reading.temperatureCelsius === 21)).toBe(true)
  })

  it('gives up after the retry budget and rejects with the HTTP error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, { status: 429 }))
    vi.stubGlobal('fetch', fetchMock)

    const dataSource = createDataSource()
    const promise = dataSource.fetchGrid({ resolutionDegrees: 180 })
    const assertion = expect(promise).rejects.toThrow('HTTP 429')
    await vi.runAllTimersAsync()
    await assertion

    // 1 initial attempt + 4 retries (MAX_RETRIES_ON_RATE_LIMIT) = 5 calls.
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('returns a partial grid when one batch permanently fails but others succeed', async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const parsed = new URL(url)
      const points = parsed.searchParams.get('latitude')?.split(',') ?? []
      if (points.length === 100) {
        // First batch: always succeeds.
        return jsonResponse(points.map(() => ({ current: { temperature_2m: 15, time: '2026-01-01T00:00' } })))
      }
      // Second batch (80 points): persistent 429, exhausts every retry.
      return jsonResponse(null, { status: 429 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const dataSource = createDataSource()
    // resolutionDegrees=20 -> 180 points -> 2 batches (100 + 80).
    const promise = dataSource.fetchGrid({ resolutionDegrees: 20 })
    await vi.runAllTimersAsync()
    const grid = await promise

    expect(grid.expectedPointCount).toBe(180)
    expect(grid.readings).toHaveLength(100)
    expect(grid.readings.every((reading) => reading.temperatureCelsius === 15)).toBe(true)
    // 1 call for the successful batch + 5 for the batch that exhausts retries (1 initial + 4 retries).
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('throttles between batches and aborting mid-wait stops before the next batch fires', async () => {
    const fetchMock = successFetch()
    vi.stubGlobal('fetch', fetchMock)

    const controller = new AbortController()
    const dataSource = createDataSource()
    // resolutionDegrees=20 -> 180 points -> 2 batches (100 + 80), exercises the inter-batch throttle.
    const promise = dataSource.fetchGrid({ resolutionDegrees: 20 }, controller.signal)

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    controller.abort()

    let caught: unknown
    try {
      await promise
    } catch (error) {
      caught = error
    }

    expect(AbortErrorDetector.isAbortError(caught)).toBe(true)
    // The second batch is never fetched: the abort interrupts the throttle wait before it fires.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
