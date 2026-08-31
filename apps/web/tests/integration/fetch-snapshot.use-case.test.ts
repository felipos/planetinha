import { describe, expect, it } from 'vitest'
import { FetchSnapshotUseCase } from '../../src/application/fetch-snapshot.use-case'
import type { SnapshotDataSourcePort } from '../../src/application/ports/snapshot-data-source.port'
import type { Snapshot } from '../../src/domain/snapshot'
import { mockEmptySnapshot, mockSnapshot } from '../fixtures/snapshot.fixture'

function createFakeDataSource(behavior: (signal?: AbortSignal) => Promise<Snapshot>): SnapshotDataSourcePort {
  return { fetchSnapshot: behavior }
}

describe('FetchSnapshotUseCase', () => {
  it('delegates to the data source port and returns the Snapshot it answers with', async () => {
    // Arrange
    const dataSource = createFakeDataSource(async () => mockSnapshot)
    const useCase = new FetchSnapshotUseCase(dataSource)

    // Act
    const result = await useCase.execute()

    // Assert
    expect(result).toBe(mockSnapshot)
    // The Resolution comes from the response: the use case asks for nothing and assumes nothing.
    expect(result.resolutionDegrees).toBe(mockSnapshot.resolutionDegrees)
  })

  it('passes the abort signal through to the data source', async () => {
    // Arrange
    let receivedSignal: AbortSignal | undefined
    const dataSource = createFakeDataSource(async (signal) => {
      receivedSignal = signal
      return mockSnapshot
    })
    const useCase = new FetchSnapshotUseCase(dataSource)
    const controller = new AbortController()

    // Act
    await useCase.execute(controller.signal)

    // Assert
    expect(receivedSignal).toBe(controller.signal)
  })

  it('propagates a rejection from the data source (error path — never fails silently)', async () => {
    // Arrange
    const dataSource = createFakeDataSource(async () => {
      throw new Error('a API do Vento está indisponível')
    })
    const useCase = new FetchSnapshotUseCase(dataSource)

    // Act
    const resultPromise = useCase.execute()

    // Assert
    await expect(resultPromise).rejects.toThrow('a API do Vento está indisponível')
  })

  it('resolves again after a prior failure (stale-error → success retry path)', async () => {
    // Arrange
    let callCount = 0
    const dataSource = createFakeDataSource(async () => {
      callCount += 1
      if (callCount === 1) {
        throw new Error('timeout')
      }
      return mockEmptySnapshot
    })
    const useCase = new FetchSnapshotUseCase(dataSource)

    // Act & Assert
    await expect(useCase.execute()).rejects.toThrow('timeout')
    await expect(useCase.execute()).resolves.toBe(mockEmptySnapshot)
  })
})
