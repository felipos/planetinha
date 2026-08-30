import { isAbortError } from '../../domain/abort-error'
import { generateGridPoints, type GridPoint } from '../../domain/grid-points'
import type { TemperatureGrid } from '../../domain/temperature-grid'
import type { TemperatureReading } from '../../domain/temperature-reading'
import type {
  TemperatureDataSourcePort,
  TemperatureGridRequest,
} from '../../application/ports/temperature-data-source-port'

/**
 * Implementação concreta de `TemperatureDataSourcePort` para a API pública do Open-Meteo (ver
 * contracts/open-meteo-forecast-request.md e research.md §5-§6).
 */

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
// Validado empiricamente (research.md, item T009): sem teto documentado fixo de coordenadas;
// o limite real observado é o tamanho da URL (HTTP 414 entre 200 e 500 coordenadas). 100
// mantém folga de segurança confortável.
const BATCH_SIZE = 100

// Espaçamento mínimo entre o disparo de dois lotes consecutivos. O Open-Meteo aplica um limite
// de rajada por minuto não documentado (research.md, achado T046) — buscar sequencialmente já
// ajuda, mas em conexões rápidas os 7 lotes da grade padrão ainda saem quase colados um no
// outro; este delay garante espaçamento real entre requisições, não só o tempo de rede da
// anterior.
const BATCH_THROTTLE_MS = 1_200

// Retry com backoff exponencial específico para HTTP 429: uma rajada pontual (ex.: dois loads
// quase simultâneos, como o double-invoke do StrictMode em dev) não deve virar erro para o
// usuário — deve esperar e tentar de novo.
const MAX_RETRIES_ON_RATE_LIMIT = 4
const INITIAL_BACKOFF_MS = 2_000
const MAX_BACKOFF_MS = 20_000
const BACKOFF_JITTER_RATIO = 0.3

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
  return `${OPEN_METEO_FORECAST_URL}?${params.toString()}`
}

function isErrorResponse(body: unknown): body is OpenMeteoErrorResponse {
  return typeof body === 'object' && body !== null && (body as OpenMeteoErrorResponse).error === true
}

/** `sleep` que respeita `signal`: aborta a espera (em vez de só ignorar o resultado depois). */
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

/** Segundos (`Retry-After: 30`) ou data HTTP (`Retry-After: <http-date>`); `null` se ausente/inválido. */
function parseRetryAfterMs(header: string | null): number | null {
  if (header === null) {
    return null
  }
  const seconds = Number(header)
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000)
  }
  const dateMs = Date.parse(header)
  if (Number.isNaN(dateMs)) {
    return null
  }
  return Math.max(0, dateMs - Date.now())
}

function backoffWithJitter(attempt: number): number {
  const base = Math.min(INITIAL_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS)
  return base + Math.random() * base * BACKOFF_JITTER_RATIO
}

async function fetchBatch(points: readonly GridPoint[], signal?: AbortSignal): Promise<TemperatureReading[]> {
  for (let attempt = 0; ; attempt += 1) {
    let response: Response
    try {
      response = await fetch(buildRequestUrl(points), { signal })
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }
      throw new Error(
        'Não foi possível conectar à API de temperatura (Open-Meteo). Verifique sua conexão.',
      )
    }

    if (response.status === 429 && attempt < MAX_RETRIES_ON_RATE_LIMIT) {
      const waitMs = parseRetryAfterMs(response.headers.get('Retry-After')) ?? backoffWithJitter(attempt)
      await sleep(waitMs, signal)
      continue
    }

    if (!response.ok) {
      throw new Error(`A API de temperatura respondeu com erro (HTTP ${response.status}).`)
    }

    const body: unknown = await response.json()

    if (isErrorResponse(body)) {
      throw new Error(`A API de temperatura retornou um erro: ${String(body.reason ?? 'desconhecido')}`)
    }

    const items: readonly OpenMeteoLocationResponse[] = Array.isArray(body)
      ? (body as OpenMeteoLocationResponse[])
      : [body as OpenMeteoLocationResponse]

    return points.map((point, index) => {
      const item = items[index]
      const temperature = item?.current?.temperature_2m
      const observedAt = item?.current?.time ?? new Date().toISOString()
      return {
        latitude: point.latitude,
        longitude: point.longitude,
        temperatureCelsius: typeof temperature === 'number' ? temperature : null,
        observedAt,
      }
    })
  }
}

export class OpenMeteoTemperatureDataSource implements TemperatureDataSourcePort {
  async fetchGrid(request: TemperatureGridRequest, signal?: AbortSignal): Promise<TemperatureGrid> {
    const points = generateGridPoints(request.resolutionDegrees)
    const batches = chunk(points, BATCH_SIZE)

    // Sequencial, não Promise.all: validado manualmente (T046) que disparar todos os lotes em
    // paralelo pode estourar um rate limit de rajada de curto prazo do Open-Meteo (HTTP 429).
    // Além disso, um delay mínimo (BATCH_THROTTLE_MS) é aplicado entre lotes, e cada lote que
    // ainda assim receber 429 tenta de novo com backoff exponencial antes de desistir.
    const readings: TemperatureReading[] = []
    for (let i = 0; i < batches.length; i += 1) {
      if (i > 0) {
        await sleep(BATCH_THROTTLE_MS, signal)
      }
      const batch = batches[i]
      if (batch === undefined) {
        continue
      }
      const batchReadings = await fetchBatch(batch, signal)
      readings.push(...batchReadings)
    }

    return {
      readings,
      fetchedAt: new Date().toISOString(),
      resolutionDegrees: request.resolutionDegrees,
    }
  }
}
