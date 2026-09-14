import { injectable } from 'tsyringe'
import { AbortErrorDetector } from '../../domain/utils/abort-error'

/**
 * Told about each attempt as it happens. A Sweep records how many upstream calls it made and how
 * many Rate Limit responses it received, because the provider does not document how it weights a
 * multi-location call — these counters are how that assumption gets checked against reality
 * rather than trusted.
 */
export interface HttpObserver {
  onAttempt?(): void
  onRateLimited?(): void
}

export type HttpMethod = 'GET' | 'POST'

export interface HttpRequestOptions {
  readonly method: HttpMethod
  /** Query params for the request. The caller never assembles a query string by hand. */
  readonly params?: Record<string, string | number>
  readonly signal?: AbortSignal
  readonly observer?: HttpObserver
}

// Retry-on-429-with-backoff is a generic HTTP transport concern (interpreting `Retry-After`,
// spacing out retries), not something specific to any one API — kept here so every data source
// gets it for free through HttpClientService instead of reimplementing it.
const MAX_RETRIES_ON_RATE_LIMIT = 4
const INITIAL_BACKOFF_MS = 2_000
const MAX_BACKOFF_MS = 20_000
const BACKOFF_JITTER_RATIO = 0.3

/** `sleep` that respects `signal`: aborts the wait itself, not only the result it precedes. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(signal.reason)
      return
    }
    const timeout = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

/** Seconds (`Retry-After: 30`) or an HTTP date (`Retry-After: <http-date>`); `null` if absent. */
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

function buildUrl(baseUrl: string, params?: Record<string, string | number>): string {
  if (params === undefined) {
    return baseUrl
  }
  const search = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
  )
  return `${baseUrl}?${search.toString()}`
}

/**
 * Thin wrapper around `fetch`. Every data source that needs to make an HTTP call goes through
 * this instead of calling `fetch` directly, so retry-with-backoff on a Rate Limit response,
 * abort propagation, and query-string assembly are consistent across every external API the api
 * talks to. It knows about HTTP and nothing about any particular provider's response shape — the
 * caller passes a base URL and its params, never an assembled URL.
 */
@injectable()
export class HttpClientService {
  async request<T>(baseUrl: string, options: HttpRequestOptions): Promise<T> {
    const url = buildUrl(baseUrl, options.params)
    const signal = options.signal
    const observer = options.observer

    for (let attempt = 0; ; attempt += 1) {
      let response: Response
      observer?.onAttempt?.()
      try {
        response = await fetch(url, { method: options.method, signal })
      } catch (error) {
        if (AbortErrorDetector.isAbortError(error)) {
          throw error
        }
        throw new Error(`Could not reach ${url}. The upstream provider is unreachable.`)
      }

      if (response.status === 429) {
        observer?.onRateLimited?.()
        if (attempt < MAX_RETRIES_ON_RATE_LIMIT) {
          const waitMs = parseRetryAfterMs(response.headers.get('Retry-After')) ?? backoffWithJitter(attempt)
          await sleep(waitMs, signal)
          continue
        }
      }

      if (!response.ok) {
        throw new Error(`The request to ${url} failed (HTTP ${response.status}).`)
      }

      return (await response.json()) as T
    }
  }
}
