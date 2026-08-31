import { inject, injectable } from 'tsyringe'
import type { StoredGridPoint } from '../domain/grid-point'
import type { Sweep } from '../domain/sweep'
import type { TickOutcome } from '../domain/tick-outcome'
import { AbortErrorDetector } from '../domain/utils/abort-error'
import { Clock } from '../infrastructure/clock.service'
import { GRID_RESOLUTION_DEGREES } from './config'
import type { ForecastSourcePort } from './ports/forecast-source.port'
import type { LoggerPort } from './ports/logger.port'
import type { ForecastToStore, SweepRepositoryPort } from './ports/sweep-repository.port'
import type { SweepConfig } from './sweep-config'
import { TOKENS } from './tokens'

/**
 * One Tick's worth of work. Given the state of the world it starts a Sweep because one is due,
 * advances the open Sweep by exactly one Slice, or does nothing at all; calling it repeatedly
 * walks a Sweep from start to completion.
 *
 * This is what converts the Budget into a safe pace. Pacing is a property of how often this
 * runs and how big a Slice is, not of how fast the network happens to be.
 */
@injectable()
export class AdvanceSweepUseCase {
  constructor(
    @inject(TOKENS.SweepRepositoryPort) private readonly repository: SweepRepositoryPort,
    @inject(TOKENS.ForecastSourcePort) private readonly forecastSource: ForecastSourcePort,
    @inject(TOKENS.SweepConfig) private readonly config: SweepConfig,
    @inject(TOKENS.LoggerPort) private readonly logger: LoggerPort,
    private readonly clock: Clock,
  ) {}

  async execute(signal?: AbortSignal): Promise<TickOutcome> {
    const openSweep = await this.repository.findOpenSweep()
    if (openSweep === null) {
      return await this.startSweepIfDue()
    }
    return await this.advanceOneSlice(openSweep, signal)
  }

  private async startSweepIfDue(): Promise<TickOutcome> {
    const now = this.clock.now()
    const lastStartedAt = await this.repository.findLastSweepStartedAt()
    if (lastStartedAt !== null && now.getTime() - lastStartedAt.getTime() < this.config.sweepIntervalMs) {
      return { kind: 'idle' }
    }

    const totalGridPointCount = await this.repository.countGridPoints(GRID_RESOLUTION_DEGREES)
    const sweep = await this.repository.startSweep(now, totalGridPointCount)
    this.logger.info('Sweep started', { sweepId: sweep.id, totalGridPointCount })
    return { kind: 'sweep-started', sweep }
  }

  private async advanceOneSlice(sweep: Sweep, signal?: AbortSignal): Promise<TickOutcome> {
    const slice = await this.repository.findSliceAfter(
      sweep.cursorGridPointId,
      this.config.sliceSize,
      GRID_RESOLUTION_DEGREES,
    )

    if (slice.length === 0) {
      const completedAt = this.clock.now()
      await this.repository.completeSweep(sweep.id, completedAt)
      this.logger.info('Sweep completed', { sweepId: sweep.id })
      return { kind: 'sweep-completed', sweepId: sweep.id }
    }

    // The cursor only ever moves as part of a commit, so nothing here advances it early.
    const cursorGridPointId = slice[slice.length - 1]?.id ?? sweep.cursorGridPointId ?? 0
    let upstreamCallsMade = 0
    let rateLimitHits = 0

    // Only the upstream call is caught here. A failure to commit is not skippable: it means
    // nothing was written and the cursor did not move, so the Tick fails and the next one
    // replays this same Slice.
    let forecasts: ForecastToStore[] = []
    let upstreamError: Error | null = null

    try {
      const window = await this.forecastSource.fetchForecastWindow(slice, {
        signal,
        onUpstreamCall: () => {
          upstreamCallsMade += 1
        },
        onRateLimited: () => {
          rateLimitHits += 1
          this.logger.warn('Rate Limit response from the upstream provider', {
            sweepId: sweep.id,
            ...AdvanceSweepUseCase.sliceFields(slice),
          })
        },
      })
      forecasts = window.forecasts.map((forecast) => ({ ...forecast, fetchedAt: window.fetchedAt }))
    } catch (error) {
      if (AbortErrorDetector.isAbortError(error)) {
        throw error
      }
      upstreamError = error instanceof Error ? error : new Error(String(error))
    }

    if (upstreamError !== null) {
      // A failing Slice is logged and skipped, and the Sweep carries on: there is deliberately
      // no retry policy and no abandonment policy in this release. The cursor still moves,
      // because skipping is a decision this Tick commits.
      this.logger.error('Slice failed and was skipped; the Sweep continues', {
        sweepId: sweep.id,
        ...AdvanceSweepUseCase.sliceFields(slice),
        errorMessage: upstreamError.message,
      })

      await this.repository.commitSlice({
        sweepId: sweep.id,
        forecasts: [],
        cursorGridPointId,
        fetchedGridPointCount: 0,
        failedGridPointCount: slice.length,
        upstreamCallsMade,
        rateLimitHits,
        lastError: upstreamError.message,
        lastSliceAt: this.clock.now(),
      })

      return {
        kind: 'slice-failed',
        sweepId: sweep.id,
        gridPointCount: slice.length,
        cursorGridPointId,
        errorMessage: upstreamError.message,
      }
    }

    await this.repository.commitSlice({
      sweepId: sweep.id,
      forecasts,
      cursorGridPointId,
      fetchedGridPointCount: slice.length,
      failedGridPointCount: 0,
      upstreamCallsMade,
      rateLimitHits,
      lastError: null,
      lastSliceAt: this.clock.now(),
    })

    return {
      kind: 'slice-advanced',
      sweepId: sweep.id,
      gridPointCount: slice.length,
      cursorGridPointId,
      forecastCount: forecasts.length,
    }
  }

  /** Identifies the Slice a log line is about by the run of Grid Points it covers. */
  private static sliceFields(slice: readonly StoredGridPoint[]): Record<string, unknown> {
    return {
      sliceFirstGridPointId: slice[0]?.id,
      sliceLastGridPointId: slice[slice.length - 1]?.id,
      sliceSize: slice.length,
    }
  }
}
