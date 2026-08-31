import 'reflect-metadata'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { GRID_RESOLUTION_DEGREES } from '../../src/application/config'
import { CheckHealthUseCase } from '../../src/application/check-health.use-case'
import { GetSnapshotUseCase } from '../../src/application/get-snapshot.use-case'
import type { SnapshotRepositoryPort } from '../../src/application/ports/snapshot-repository.port'
import type { SnapshotBody } from '../../src/presentation/routes/snapshot.route'
import { Clock } from '../../src/infrastructure/clock.service'
import { Server } from '../../src/server'
import { FixedClock } from '../fixtures/clock.fixture'
import { createFakeSnapshotRepository, storedGrid } from '../fixtures/snapshot-repository.fixture'

const NOW = new Date('2026-08-31T09:41:23.000Z')
const CURRENT_HOUR = '2026-08-31T09:00:00.000Z'
const LONGITUDE_COLUMNS = 360 / GRID_RESOLUTION_DEGREES

async function getSnapshot(
  repository: SnapshotRepositoryPort,
  clock: Clock = new FixedClock(NOW),
): Promise<{ statusCode: number; body: SnapshotBody }> {
  const app = Server.build({
    checkHealthUseCase: new CheckHealthUseCase(clock),
    getSnapshotUseCase: new GetSnapshotUseCase(repository, clock),
  })
  const response = await app.inject({ method: 'GET', url: '/api/snapshot' })
  await app.close()
  return { statusCode: response.statusCode, body: response.json<SnapshotBody>() }
}

describe('GET /api/snapshot', () => {
  it('returns a fully covered Snapshot with its Valid At, Resolution, Coverage, and sweep block', async () => {
    // Arrange
    const repository = createFakeSnapshotRepository({
      forecastsByValidAt: new Map([[CURRENT_HOUR, storedGrid(() => 12.5)]]),
      sweep: { status: 'completed', completedAt: new Date('2026-08-31T09:26:00.000Z') },
    })

    // Act
    const { statusCode, body } = await getSnapshot(repository)

    // Assert
    assert.equal(statusCode, 200)
    assert.equal(body.validAt, CURRENT_HOUR)
    assert.equal(body.resolutionDegrees, GRID_RESOLUTION_DEGREES)
    assert.deepEqual(body.coverage, { total: 2_664, withData: 2_664 })
    assert.deepEqual(body.sweep, { status: 'completed', completedAt: '2026-08-31T09:26:00.000Z' })
    assert.equal(body.forecasts.length, 2_664)
  })

  it('expands each stored pole Grid Point across all 72 longitudes', async () => {
    // Arrange
    const repository = createFakeSnapshotRepository({
      forecastsByValidAt: new Map([[CURRENT_HOUR, storedGrid((point) => point.latitude)]]),
    })

    // Act
    const { body } = await getSnapshot(repository)

    // Assert
    const northPole = body.forecasts.filter((forecast) => forecast.latitude === 90)
    const southPole = body.forecasts.filter((forecast) => forecast.latitude === -90)
    assert.equal(northPole.length, LONGITUDE_COLUMNS)
    assert.equal(southPole.length, LONGITUDE_COLUMNS)
    assert.equal(new Set(northPole.map((forecast) => forecast.longitude)).size, LONGITUDE_COLUMNS)
    assert.ok(northPole.every((forecast) => forecast.temperatureCelsius === 90))
    // The Coverage total describes the expanded lattice, never the 2,522 rows actually stored.
    assert.equal(body.coverage.total, 2_664)
  })

  it('returns null for the Grid Points with No Data and counts only the ones with a temperature', async () => {
    // Arrange
    // The northern hemisphere has data; everything below the equator does not.
    const repository = createFakeSnapshotRepository({
      forecastsByValidAt: new Map([[CURRENT_HOUR, storedGrid((point) => (point.latitude > 0 ? 3 : null))]]),
    })

    // Act
    const { body } = await getSnapshot(repository)

    // Assert
    const withData = body.forecasts.filter((forecast) => forecast.temperatureCelsius !== null)
    const noData = body.forecasts.filter((forecast) => forecast.temperatureCelsius === null)
    assert.equal(body.forecasts.length, 2_664)
    assert.equal(body.coverage.withData, withData.length)
    assert.ok(withData.length > 0 && noData.length > 0)
    assert.ok(noData.every((forecast) => forecast.temperatureCelsius === null))
    // No Data is null, never zero: nothing was coerced into a real temperature.
    assert.ok(withData.every((forecast) => forecast.temperatureCelsius === 3))
  })

  it('succeeds with every temperature null and Coverage zero before the first Sweep completes', async () => {
    // Arrange
    const repository = createFakeSnapshotRepository()

    // Act
    const { statusCode, body } = await getSnapshot(repository)

    // Assert
    assert.equal(statusCode, 200)
    assert.equal(body.validAt, CURRENT_HOUR)
    assert.deepEqual(body.coverage, { total: 2_664, withData: 0 })
    assert.deepEqual(body.sweep, { status: null, completedAt: null })
    assert.equal(body.forecasts.length, 2_664)
    assert.ok(body.forecasts.every((forecast) => forecast.temperatureCelsius === null))
  })

  it('falls back to the most recent hour that has data and reports that hour as its Valid At', async () => {
    // Arrange
    const earlierHour = '2026-08-31T07:00:00.000Z'
    const repository = createFakeSnapshotRepository({
      forecastsByValidAt: new Map([
        ['2026-08-31T05:00:00.000Z', storedGrid(() => 1)],
        [earlierHour, storedGrid(() => 2)],
        // A later hour exists too, and must not be served as if it were now.
        ['2026-08-31T11:00:00.000Z', storedGrid(() => 3)],
      ]),
    })

    // Act
    const { body } = await getSnapshot(repository)

    // Assert
    assert.equal(body.validAt, earlierHour)
    assert.ok(body.forecasts.every((forecast) => forecast.temperatureCelsius === 2))
  })

  it('carries a Fetched At on every Forecast and none at the top level', async () => {
    // Arrange
    const fetchedAt = new Date('2026-08-31T08:03:00.000Z')
    const repository = createFakeSnapshotRepository({
      forecastsByValidAt: new Map([
        [CURRENT_HOUR, storedGrid((point) => (point.latitude > 0 ? 3 : null), fetchedAt)],
      ]),
    })

    // Act
    const { body } = await getSnapshot(repository)

    // Assert
    assert.ok(!Object.keys(body).includes('fetchedAt'))
    const withData = body.forecasts.filter((forecast) => forecast.temperatureCelsius !== null)
    assert.ok(withData.every((forecast) => forecast.fetchedAt === fetchedAt.toISOString()))
    // A Grid Point with No Data has no Fetched At either — nothing was fetched for it.
    const noData = body.forecasts.filter((forecast) => forecast.temperatureCelsius === null)
    assert.ok(noData.every((forecast) => forecast.fetchedAt === null))
  })

  it('reports a Sweep in progress alongside the hour it is filling in', async () => {
    // Arrange
    const repository = createFakeSnapshotRepository({
      forecastsByValidAt: new Map([[CURRENT_HOUR, storedGrid((point) => (point.longitude < 0 ? 8 : null))]]),
      sweep: { status: 'in_progress', completedAt: null },
    })

    // Act
    const { body } = await getSnapshot(repository)

    // Assert
    assert.deepEqual(body.sweep, { status: 'in_progress', completedAt: null })
    assert.ok(body.coverage.withData > 0 && body.coverage.withData < body.coverage.total)
  })
})
