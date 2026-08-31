import { useEffect, useState } from 'react'
import { TEMPERATURE_REFRESH_INTERVAL_MS } from '../../application/config'
import type { FetchTemperatureGridUseCase } from '../../application/fetch-temperature-grid.use-case'
import { AbortErrorDetector } from '../../domain/utils/abort-error'
import type { DataFetchStatus } from '../../domain/data-fetch-status'

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Erro desconhecido ao buscar dados de temperatura.'
}

/**
 * Fetches the temperature grid on mount and exposes the loading/error state, with an automatic
 * re-fetch every `TEMPERATURE_REFRESH_INTERVAL_MS`. A failure on refresh never clears the data
 * already shown: the status moves to `stale-error`, preserving `lastGood`, instead of reverting
 * to `loading`/`hard-error`.
 *
 * When the fetch only PARTIALLY fails (some regions of the grid came back, others didn't —
 * `grid.readings.length < grid.expectedPointCount`), the status becomes `partial-success`
 * instead of `success`: it shows the freshly-fetched grid even if incomplete (instead of
 * discarding it over a failure that wasn't total), with the coverage percentage to inform the
 * user.
 *
 * A per-effect-run `AbortController` ensures a stale fetch (e.g. React `StrictMode`'s
 * double-invoke in dev — mount → cleanup → mount — or a real unmount) is actually cancelled
 * instead of just having its result ignored: without this, the underlying fetch/backoff would
 * keep running in the background, wasting API quota.
 */
export function useTemperatureGrid(
  fetchTemperatureGridUseCase: FetchTemperatureGridUseCase,
): DataFetchStatus {
  const [status, setStatus] = useState<DataFetchStatus>({ kind: 'idle' })

  useEffect(() => {
    const controller = new AbortController()

    async function load(): Promise<void> {
      // Keeps the last valid view (success, partial-success, or stale-error) visible during a
      // silent background refresh; only shows "loading" when there's no data at all to display
      // yet.
      setStatus((previous) =>
        previous.kind === 'success' || previous.kind === 'partial-success' || previous.kind === 'stale-error'
          ? previous
          : { kind: 'loading' },
      )
      try {
        const grid = await fetchTemperatureGridUseCase.execute(controller.signal)
        if (grid.readings.length < grid.expectedPointCount) {
          const coveragePercent =
            grid.expectedPointCount === 0
              ? 100
              : Math.round((grid.readings.length / grid.expectedPointCount) * 100)
          setStatus({ kind: 'partial-success', grid, coveragePercent })
        } else {
          setStatus({ kind: 'success', grid })
        }
      } catch (error) {
        if (AbortErrorDetector.isAbortError(error)) {
          // Intentional cancellation, not a real failure — must not become an error for the user.
          return
        }
        const errorMessage = describeError(error)
        setStatus((previous) => {
          if (previous.kind === 'success' || previous.kind === 'partial-success') {
            return { kind: 'stale-error', lastGood: previous.grid, errorMessage }
          }
          if (previous.kind === 'stale-error') {
            return { kind: 'stale-error', lastGood: previous.lastGood, errorMessage }
          }
          return { kind: 'hard-error', errorMessage }
        })
      }
    }

    void load()
    const intervalId = window.setInterval(() => {
      void load()
    }, TEMPERATURE_REFRESH_INTERVAL_MS)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [fetchTemperatureGridUseCase])

  return status
}
