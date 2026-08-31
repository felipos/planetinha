import 'reflect-metadata'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AdvanceSweepUseCase } from '../../src/application/advance-sweep.use-case'
import type { ForecastSourcePort } from '../../src/application/ports/forecast-source.port'
import type { SweepConfig } from '../../src/application/sweep-config'
import { Clock } from '../../src/infrastructure/clock.service'
import { FixedClock } from '../fixtures/clock.fixture'
import {
  WINDOW_START,
  createFakeForecastSource,
  createRecordingLogger,
} from '../fixtures/forecast-source.fixture'
import {
  createFakeSweepRepository,
  storedGridPoints,
  type FakeSweepRepository,
} from '../fixtures/sweep-repository.fixture'

const NOW = new Date('2026-08-31T09:00:00.000Z')
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1_000
const HOURS_IN_WINDOW = 48

interface Harness {
  readonly useCase: AdvanceSweepUseCase
  readonly repository: FakeSweepRepository
  readonly logger: ReturnType<typeof createRecordingLogger>
}

function createHarness(options: {
  gridPointCount?: number
  sliceSize?: number
  forecastSource?: ForecastSourcePort
  clock?: Clock
}): Harness {
  const repository = createFakeSweepRepository(storedGridPoints(options.gridPointCount ?? 5))
  const logger = createRecordingLogger()
  const config: SweepConfig = {
    sliceSize: options.sliceSize ?? 2,
    sweepIntervalMs: TWELVE_HOURS_MS,
  }
  const useCase = new AdvanceSweepUseCase(
    repository,
    options.forecastSource ?? createFakeForecastSource(),
    config,
    logger,
    options.clock ?? new FixedClock(NOW),
  )
  return { useCase, repository, logger }
}

describe('AdvanceSweepUseCase — one Tick', () => {
  it('starts a Sweep when none is open and one is due, recording its start and total', async () => {
    // Arrange
    const { useCase, repository } = createHarness({ gridPointCount: 5 })

    // Act
    const outcome = await useCase.execute()

    // Assert
    assert.equal(outcome.kind, 'sweep-started')
    assert.equal(repository.sweeps.length, 1)
    assert.deepEqual(repository.sweeps[0]?.startedAt, NOW)
    assert.equal(repository.sweeps[0]?.totalGridPointCount, 5)
    assert.equal(repository.sweeps[0]?.status, 'in_progress')
    assert.equal(repository.sweeps[0]?.cursorGridPointId, null)
  })

  it('does nothing when no Sweep is open and none is due yet', async () => {
    // Arrange
    const { useCase, repository } = createHarness({})
    await repository.startSweep(new Date(NOW.getTime() - TWELVE_HOURS_MS + 60_000), 5)
    await repository.completeSweep(1, new Date(NOW.getTime() - 60_000))

    // Act
    const outcome = await useCase.execute()

    // Assert
    assert.equal(outcome.kind, 'idle')
    assert.equal(repository.sweeps.length, 1)
  })

  it('advances the cursor by exactly one Slice and writes that Slice Forecasts', async () => {
    // Arrange
    const { useCase, repository } = createHarness({ gridPointCount: 5, sliceSize: 2 })
    await useCase.execute() // starts the Sweep

    // Act
    const outcome = await useCase.execute()

    // Assert
    assert.equal(outcome.kind, 'slice-advanced')
    assert.equal(repository.sweeps[0]?.cursorGridPointId, 2)
    assert.equal(repository.sweeps[0]?.fetchedGridPointCount, 2)
    // Two Grid Points × 48 hours: one Sweep of a Grid Point yields two days of Forecasts.
    assert.equal(repository.forecastsByKey.size, 2 * HOURS_IN_WINDOW)
    const stored = repository.forecastsByKey.get(`1|${WINDOW_START.toISOString()}`)
    assert.equal(stored?.temperatureCelsius, 10)
    assert.deepEqual(stored?.fetchedAt, new Date('2026-08-31T09:15:00.000Z'))
  })

  it('walks the Sweep to completion one Slice at a time', async () => {
    // Arrange
    const { useCase, repository } = createHarness({ gridPointCount: 5, sliceSize: 2 })

    // Act
    // Start, three Slices (2 + 2 + 1), then the Tick that finds nothing left to do.
    const outcomes = []
    for (let tick = 0; tick < 5; tick += 1) {
      outcomes.push((await useCase.execute()).kind)
    }

    // Assert
    assert.deepEqual(outcomes, [
      'sweep-started',
      'slice-advanced',
      'slice-advanced',
      'slice-advanced',
      'sweep-completed',
    ])
    assert.equal(repository.sweeps[0]?.status, 'completed')
    assert.equal(repository.sweeps[0]?.fetchedGridPointCount, 5)
    assert.equal(repository.forecastsByKey.size, 5 * HOURS_IN_WINDOW)
  })

  it('produces no duplicate Forecast when a Slice is replayed, and a fresher one overwrites', async () => {
    // Arrange
    const first = createHarness({
      gridPointCount: 2,
      sliceSize: 2,
      forecastSource: createFakeForecastSource({
        temperature: () => 1,
        fetchedAt: new Date('2026-08-31T09:15:00.000Z'),
      }),
    })
    await first.useCase.execute()
    await first.useCase.execute()
    const afterFirstPass = first.repository.forecastsByKey.size

    // Act
    // The same Grid Points swept again, with a fresher Forecast for the same hours.
    const replay = new AdvanceSweepUseCase(
      first.repository,
      createFakeForecastSource({
        temperature: () => 2,
        fetchedAt: new Date('2026-08-31T21:15:00.000Z'),
      }),
      { sliceSize: 2, sweepIntervalMs: TWELVE_HOURS_MS },
      first.logger,
      new FixedClock(new Date(NOW.getTime() + TWELVE_HOURS_MS)),
    )
    await replay.execute() // the finished Sweep is completed first
    await replay.execute() // a new Sweep is due and starts
    await replay.execute() // its first Slice replays the same Grid Points

    // Assert
    assert.equal(first.repository.forecastsByKey.size, afterFirstPass)
    const overwritten = first.repository.forecastsByKey.get(`1|${WINDOW_START.toISOString()}`)
    assert.equal(overwritten?.temperatureCelsius, 2)
    assert.deepEqual(overwritten?.fetchedAt, new Date('2026-08-31T21:15:00.000Z'))
  })

  it('logs and skips a Slice whose upstream call fails, and carries the Sweep on', async () => {
    // Arrange
    const { useCase, repository, logger } = createHarness({
      gridPointCount: 4,
      sliceSize: 2,
      forecastSource: createFakeForecastSource({ failWith: 'the provider is having a bad day' }),
    })
    await useCase.execute() // starts the Sweep

    // Act
    const outcome = await useCase.execute()

    // Assert
    assert.equal(outcome.kind, 'slice-failed')
    assert.equal(repository.sweeps[0]?.failedGridPointCount, 2)
    assert.equal(repository.sweeps[0]?.fetchedGridPointCount, 0)
    assert.equal(repository.sweeps[0]?.lastError, 'the provider is having a bad day')
    assert.equal(repository.sweeps[0]?.status, 'in_progress')
    assert.ok(
      logger.lines.some((line) => line.level === 'error' && line.fields.sliceFirstGridPointId === 1),
      'the failure is logged against the Slice that caused it',
    )
    // The next Tick moves on to the following Slice rather than retrying this one.
    assert.equal(repository.sweeps[0]?.cursorGridPointId, 2)
  })

  it('leaves the cursor where it was when a Slice does not commit', async () => {
    // Arrange
    const { useCase, repository } = createHarness({ gridPointCount: 4, sliceSize: 2 })
    await useCase.execute() // starts the Sweep
    repository.failNextCommit = true

    // Act
    // Standing in for a process that dies mid-Slice: the commit never lands.
    const failure = await useCase.execute().catch((error: unknown) => error)

    // Assert
    assert.ok(failure instanceof Error)
    assert.equal(repository.sweeps[0]?.cursorGridPointId, null)
    assert.equal(repository.forecastsByKey.size, 0)

    // On restart the same Slice replays, and this time it commits.
    const outcome = await useCase.execute()
    assert.equal(outcome.kind, 'slice-advanced')
    assert.equal(repository.sweeps[0]?.cursorGridPointId, 2)
  })

  it('accumulates upstream calls made and Rate Limit hits on the Sweep', async () => {
    // Arrange
    const { useCase, repository, logger } = createHarness({
      gridPointCount: 4,
      sliceSize: 2,
      forecastSource: createFakeForecastSource({ upstreamCallsPerFetch: 3, rateLimitsPerFetch: 2 }),
    })

    // Act
    await useCase.execute() // start
    await useCase.execute() // first Slice
    await useCase.execute() // second Slice

    // Assert
    assert.equal(repository.sweeps[0]?.upstreamCallsMade, 6)
    assert.equal(repository.sweeps[0]?.rateLimitHits, 4)
    const rateLimitLines = logger.lines.filter((line) => line.message.includes('Rate Limit'))
    assert.equal(rateLimitLines.length, 4)
    assert.ok(rateLimitLines.every((line) => typeof line.fields.sliceFirstGridPointId === 'number'))
  })

  it('takes the Slice size from configuration rather than a constant', async () => {
    // Arrange
    const { useCase, repository } = createHarness({ gridPointCount: 10, sliceSize: 7 })
    await useCase.execute() // starts the Sweep

    // Act
    await useCase.execute()

    // Assert
    assert.equal(repository.sweeps[0]?.cursorGridPointId, 7)
    assert.equal(repository.sweeps[0]?.fetchedGridPointCount, 7)
  })
})
