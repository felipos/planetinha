import 'reflect-metadata'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { container } from 'tsyringe'
import { CheckHealthUseCase } from '../../src/domain/usecases/check-health.usecase'
import { GetSnapshotUseCase } from '../../src/domain/usecases/get-snapshot.usecase'
import { DiContainer } from '../../src/di-container'
import { Clock } from '../../src/core/clock.service'
import { Server } from '../../src/server'
import { createFakeForecastsDataSource } from '../fixtures/forecasts-datasource.fixture'
import { createFakeSweepsDataSource } from '../fixtures/sweeps-datasource.fixture'

function buildServer(): ReturnType<typeof Server.build> {
  const clock = new Clock()
  return Server.build({
    checkHealthUseCase: new CheckHealthUseCase(clock),
    getSnapshotUseCase: new GetSnapshotUseCase(
      createFakeForecastsDataSource(),
      createFakeSweepsDataSource(),
      clock,
    ),
  })
}

describe('GET /health', () => {
  it('answers successfully without reading a Snapshot, a Forecast, or a Grid Point', async () => {
    // Arrange
    const app = buildServer()

    // Act
    const response = await app.inject({ method: 'GET', url: '/health' })

    // Assert
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().status, 'ok')
    await app.close()
  })

  it('resolves a use case whose constructor dependency is a concrete class', () => {
    // Arrange
    DiContainer.setup()

    // Act
    // A concrete-class dependency (`Clock`) resolves only from emitted decorator metadata, so
    // this fails at RUNTIME under a loader that strips types without emitting it.
    const useCase = container.resolve(CheckHealthUseCase)

    // Assert
    assert.equal(useCase.execute().status, 'ok')
    assert.doesNotThrow(() => new Date(useCase.execute().checkedAt).toISOString())
  })
})
