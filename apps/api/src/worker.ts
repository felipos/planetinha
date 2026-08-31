import 'reflect-metadata'
import { container } from 'tsyringe'
import { AdvanceSweepUseCase } from './application/advance-sweep.use-case'
import type { LoggerPort } from './application/ports/logger.port'
import { TOKENS } from './application/tokens'
import { DiContainer } from './di-container'
import { DatabaseReadiness } from './infrastructure/database/database-readiness.service'
import { Database } from './infrastructure/database/database.service'
import { Env } from './infrastructure/env.service'

/**
 * The worker: the only process that ever calls the upstream provider.
 *
 * It is its own entrypoint rather than a plugin inside the api, and that is structural. Scaling
 * the api to several replicas has to leave exactly one worker running, because a worker
 * embedded in the api would multiply upstream traffic by the replica count and destroy the
 * accounting the whole design rests on.
 *
 * On each Tick it advances the open Sweep by one Slice, starts a Sweep if one is due, or does
 * nothing. Pacing therefore comes from the Tick and the Slice size, not from how fast the
 * network happens to be.
 */
DiContainer.setup()

const logger = container.resolve<LoggerPort>(TOKENS.LoggerPort)
const database = container.resolve(Database)

// Fail fast, before the first Tick: a worker against an unmigrated or unseeded database would
// otherwise silently sweep zero Grid Points.
try {
  await container.resolve(DatabaseReadiness).verify()
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error))
  await database.close()
  process.exit(1)
}

const advanceSweepUseCase = container.resolve(AdvanceSweepUseCase)
const controller = new AbortController()
let tickInProgress = false

async function tick(): Promise<void> {
  // A Tick that overruns its successor is skipped rather than run in parallel: two Ticks at once
  // would double the pace the Budget is spent at.
  if (tickInProgress) {
    logger.warn('Tick skipped: the previous one is still running')
    return
  }

  tickInProgress = true
  try {
    const outcome = await advanceSweepUseCase.execute(controller.signal)
    if (outcome.kind !== 'idle') {
      logger.info('Tick completed', { ...outcome })
    }
  } catch (error) {
    // Nothing was committed, so the next Tick replays whatever this one was doing.
    logger.error('Tick failed', { errorMessage: error instanceof Error ? error.message : String(error) })
  } finally {
    tickInProgress = false
  }
}

logger.info('Worker started', {
  tickIntervalMs: Env.TICK_INTERVAL_MS,
  sliceSize: Env.SLICE_SIZE,
  sweepIntervalMs: Env.SWEEP_INTERVAL_MS,
})

void tick()
const ticker = setInterval(() => void tick(), Env.TICK_INTERVAL_MS)

async function shutdown(signal: string): Promise<void> {
  logger.info('Worker stopping', { signal })
  clearInterval(ticker)
  // Aborting interrupts an in-flight upstream call and any backoff wait it is parked in. The
  // Slice it was working on never commits, so the next start replays it from the cursor.
  controller.abort()
  await database.close()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
