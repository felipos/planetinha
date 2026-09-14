import { injectable } from 'tsyringe'
import { AbortErrorDetector } from '../../domain/utils/abort-error'

export type HttpMethod = 'GET' | 'POST'

export interface HttpRequestOptions {
  readonly method: HttpMethod
  /** Query params for the request. The caller never assembles a query string by hand. */
  readonly params?: Record<string, string | number>
  readonly signal?: AbortSignal
}

// Retry-on-429-with-backoff is a generic HTTP transport concern (interpreting `Retry-After`,
// spacing out retries), not something specific to any one API — kept here so every data source
// gets it for free through HttpClientService instead of reimplementing it.
const MAX_RETRIES_ON_RATE_LIMIT = 4
const INITIAL_BACKOFF_MS = 2_000
const MAX_BACKOFF_MS = 20_000
const BACKOFF_JITTER_RATIO = 0.3

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

/** Seconds (`Retry-After: 30`) or an HTTP date (`Retry-After: <http-date>`); `null` if absent/invalid. */
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
 * Thin wrapper around `fetch`. Every data source that needs to make HTTP calls should go
 * through this instead of calling `fetch` directly, so retry/backoff-on-429, abort handling, and
 * query-string assembly are consistent across every external API this app talks to. The caller
 * passes a base URL and its params, never an assembled URL.
 */
@injectable()
export class HttpClientService {
  async request<T>(baseUrl: string, options: HttpRequestOptions): Promise<T> {
    const url = buildUrl(baseUrl, options.params)
    const signal = options.signal
    for (let attempt = 0; ; attempt += 1) {
      let response: Response
      try {
        response = await fetch(url, { method: options.method, signal })
      } catch (error) {
        if (AbortErrorDetector.isAbortError(error)) {
          throw error
        }
        throw new Error(`Could not reach ${url}. Check your connection.`)
      }

      if (response.status === 429 && attempt < MAX_RETRIES_ON_RATE_LIMIT) {
        const waitMs = parseRetryAfterMs(response.headers.get('Retry-After')) ?? backoffWithJitter(attempt)
        await sleep(waitMs, signal)
        continue
      }

      if (!response.ok) {
        throw new Error(`The request to ${url} failed (HTTP ${response.status}).`)
      }

      return (await response.json()) as T
    }
  }
}
