import { useEffect, useState } from 'react'
import { TEMPERATURE_REFRESH_INTERVAL_MS } from '../../application/config'
import type { FetchSnapshotUseCase } from '../../application/fetch-snapshot.use-case'
import { AbortErrorDetector } from '../../domain/utils/abort-error'
import { CoverageCalculator } from '../../domain/utils/coverage'
import type { DataFetchStatus } from '../../domain/data-fetch-status'
import type { Snapshot } from '../../domain/snapshot'

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Erro desconhecido ao buscar dados de temperatura.'
}

/** A Snapshot that isn't fully covered is either still filling in or genuinely gappy. */
function statusFor(snapshot: Snapshot): DataFetchStatus {
  if (CoverageCalculator.isComplete(snapshot.coverage)) {
    return { kind: 'success', snapshot }
  }
  const coveragePercent = CoverageCalculator.percent(snapshot.coverage)
  if (CoverageCalculator.isInitialLoad(snapshot)) {
    return { kind: 'initial-load', snapshot, coveragePercent }
  }
  return { kind: 'partial-success', snapshot, coveragePercent }
}

/** Statuses that already have a Snapshot on screen worth keeping during a refresh. */
function shownSnapshot(status: DataFetchStatus): Snapshot | null {
  switch (status.kind) {
    case 'success':
    case 'initial-load':
    case 'partial-success':
      return status.snapshot
    case 'stale-error':
      return status.lastGood
    default:
      return null
  }
}

/**
 * Fetches a Snapshot on mount and exposes the loading/error state, with an automatic re-fetch
 * every `TEMPERATURE_REFRESH_INTERVAL_MS`. A failure on refresh never clears the data already
 * shown: the status moves to `stale-error`, preserving `lastGood`, instead of reverting to
 * `loading`/`hard-error`.
 *
 * A per-effect-run `AbortController` ensures a stale fetch (e.g. React `StrictMode`'s
 * double-invoke in dev — mount → cleanup → mount — or a real unmount) is actually cancelled
 * instead of just having its result ignored.
 */
export function useSnapshot(fetchSnapshotUseCase: FetchSnapshotUseCase): DataFetchStatus {
  const [status, setStatus] = useState<DataFetchStatus>({ kind: 'idle' })

  useEffect(() => {
    const controller = new AbortController()

    async function load(): Promise<void> {
      // Keeps whatever is already on screen visible during a silent background refresh; only
      // shows "loading" when there's no data at all to display yet.
      setStatus((previous) => (shownSnapshot(previous) === null ? { kind: 'loading' } : previous))
      try {
        setStatus(statusFor(await fetchSnapshotUseCase.execute(controller.signal)))
      } catch (error) {
        if (AbortErrorDetector.isAbortError(error)) {
          // Intentional cancellation, not a real failure — must not become an error for the user.
          return
        }
        const errorMessage = describeError(error)
        setStatus((previous) => {
          const lastGood = shownSnapshot(previous)
          if (lastGood === null) {
            return { kind: 'hard-error', errorMessage }
          }
          return { kind: 'stale-error', lastGood, errorMessage }
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
  }, [fetchSnapshotUseCase])

  return status
}
