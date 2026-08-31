import 'reflect-metadata'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { container } from 'tsyringe'
import { CheckHealthUseCase } from '../../src/application/check-health.use-case'
import { DiContainer } from '../../src/di-container'
import { Server } from '../../src/server'

describe('GET /health', () => {
  it('answers successfully without reading a Snapshot, a Forecast, or a Grid Point', async () => {
    // Arrange
    DiContainer.setup()
    const app = Server.build({ checkHealthUseCase: container.resolve(CheckHealthUseCase) })

    // Act
    const response = await app.inject({ method: 'GET', url: '/health' })

    // Assert
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().status, 'ok')
    await app.close()
  })

  it('resolves a use case whose constructor dependency is a concrete class', async () => {
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
