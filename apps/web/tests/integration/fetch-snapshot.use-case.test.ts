import { describe, expect, it } from 'vitest'
import { DEFAULT_GRID_RESOLUTION_DEGREES } from '../../src/application/config'
import { FetchSnapshotUseCase } from '../../src/application/fetch-snapshot.use-case'
import type {
  SnapshotDataSourcePort,
  SnapshotRequest,
} from '../../src/application/ports/snapshot-data-source.port'
import type { Snapshot } from '../../src/domain/snapshot'
import { mockEmptySnapshot, mockSnapshot } from '../fixtures/snapshot.fixture'

function createFakeDataSource(
  behavior: (request: SnapshotRequest) => Promise<Snapshot>,
): SnapshotDataSourcePort {
  return { fetchSnapshot: behavior }
}

describe('FetchSnapshotUseCase', () => {
  it('delegates to the data source port with the configured Resolution (success path)', async () => {
    // Arrange
    const snapshot: Snapshot = { ...mockSnapshot, resolutionDegrees: DEFAULT_GRID_RESOLUTION_DEGREES }
    let receivedRequest: SnapshotRequest | undefined
    const dataSource = createFakeDataSource(async (request) => {
      receivedRequest = request
      return snapshot
    })
    const useCase = new FetchSnapshotUseCase(dataSource)

    // Act
    const result = await useCase.execute()

    // Assert
    expect(result).toBe(snapshot)
    expect(receivedRequest).toEqual({ resolutionDegrees: DEFAULT_GRID_RESOLUTION_DEGREES })
  })

  it('propagates a rejection from the data source (error path — never fails silently)', async () => {
    // Arrange
    const dataSource = createFakeDataSource(async () => {
      throw new Error('Open-Meteo indisponível')
    })
    const useCase = new FetchSnapshotUseCase(dataSource)

    // Act
    const resultPromise = useCase.execute()

    // Assert
    await expect(resultPromise).rejects.toThrow('Open-Meteo indisponível')
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
