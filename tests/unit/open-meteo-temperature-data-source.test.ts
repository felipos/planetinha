import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isAbortError } from '../../src/domain/abort-error'
import { OpenMeteoTemperatureDataSource } from '../../src/infrastructure/open-meteo/open-meteo-temperature-data-source'

function jsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Response {
  const status = init?.status ?? 200
  const headers = init?.headers ?? {}
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    json: async () => body,
  } as unknown as Response
}

/** Gera uma resposta de sucesso com uma leitura por coordenada da URL, qualquer que seja o lote. */
function successFetch(): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string | URL) => {
    const parsed = new URL(url)
    const points = parsed.searchParams.get('latitude')?.split(',') ?? []
    return jsonResponse(
      points.map(() => ({ current: { temperature_2m: 15, time: '2026-01-01T00:00' } })),
    )
  })
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
      return jsonResponse(
        points.map(() => ({ current: { temperature_2m: 21, time: '2026-01-01T00:00' } })),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const dataSource = new OpenMeteoTemperatureDataSource()
    // resolutionDegrees=180 -> só 4 pontos -> 1 lote, isola o comportamento de retry.
    const promise = dataSource.fetchGrid({ resolutionDegrees: 180 })
    await vi.advanceTimersByTimeAsync(3_000)
    const grid = await promise

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(grid.readings.every((reading) => reading.temperatureCelsius === 21)).toBe(true)
  })

  it('gives up after the retry budget and rejects with the HTTP error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, { status: 429 }))
    vi.stubGlobal('fetch', fetchMock)

    const dataSource = new OpenMeteoTemperatureDataSource()
    const promise = dataSource.fetchGrid({ resolutionDegrees: 180 })
    const assertion = expect(promise).rejects.toThrow('HTTP 429')
    await vi.runAllTimersAsync()
    await assertion

    // 1 tentativa inicial + 4 retries (MAX_RETRIES_ON_RATE_LIMIT) = 5 chamadas.
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('throttles between batches and aborting mid-wait stops before the next batch fires', async () => {
    const fetchMock = successFetch()
    vi.stubGlobal('fetch', fetchMock)

    const controller = new AbortController()
    const dataSource = new OpenMeteoTemperatureDataSource()
    // resolutionDegrees=20 -> 180 pontos -> 2 lotes (100 + 80), exercita o throttle entre lotes.
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

    expect(isAbortError(caught)).toBe(true)
    // O segundo lote nunca chega a ser buscado: o abort interrompe a espera de throttle antes.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
