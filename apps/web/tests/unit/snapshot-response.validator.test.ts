import { describe, expect, it } from 'vitest'
import { SnapshotResponseValidator } from '../../src/infrastructure/vento/snapshot-response.validator'

const validBody = {
  validAt: '2026-08-31T09:00:00.000Z',
  resolutionDegrees: 5,
  coverage: { total: 2664, withData: 1 },
  sweep: { status: 'in_progress', completedAt: null },
  forecasts: [
    { latitude: 0, longitude: 0, temperatureCelsius: 21.5, fetchedAt: '2026-08-31T08:40:00.000Z' },
    { latitude: 5, longitude: 0, temperatureCelsius: null, fetchedAt: null },
  ],
}

describe('SnapshotResponseValidator', () => {
  it('reads the Resolution from the response rather than assuming one', () => {
    // Arrange
    const body = { ...validBody, resolutionDegrees: 2.5 }

    // Act
    const snapshot = SnapshotResponseValidator.toSnapshot(body)

    // Assert
    expect(snapshot.resolutionDegrees).toBe(2.5)
  })

  it('takes the Coverage total as the number of Grid Points the Grid holds', () => {
    // Arrange & Act
    const snapshot = SnapshotResponseValidator.toSnapshot(validBody)

    // Assert
    expect(snapshot.expectedPointCount).toBe(2664)
    expect(snapshot.forecasts).toHaveLength(2)
  })

  it('keeps No Data distinct from a real temperature of zero', () => {
    // Arrange
    const body = {
      ...validBody,
      forecasts: [
        { latitude: 0, longitude: 0, temperatureCelsius: 0, fetchedAt: '2026-08-31T08:40:00.000Z' },
        { latitude: 5, longitude: 0, temperatureCelsius: null, fetchedAt: null },
      ],
    }

    // Act
    const snapshot = SnapshotResponseValidator.toSnapshot(body)

    // Assert
    expect(snapshot.forecasts[0]?.temperatureCelsius).toBe(0)
    expect(snapshot.forecasts[1]?.temperatureCelsius).toBeNull()
  })

  it('stamps every Forecast with the hour the Snapshot describes', () => {
    // Arrange & Act
    const snapshot = SnapshotResponseValidator.toSnapshot(validBody)

    // Assert
    expect(snapshot.forecasts.every((forecast) => forecast.validAt === validBody.validAt)).toBe(true)
  })

  it('rejects a malformed response with a stated error instead of rendering it', () => {
    // Arrange
    const malformedBodies: unknown[] = [
      null,
      'not json at all',
      { ...validBody, forecasts: 'nope' },
      { ...validBody, resolutionDegrees: 0 },
      { ...validBody, coverage: { total: 'many', withData: 1 } },
      // A missing temperature field is not the same as an explicit No Data.
      { ...validBody, forecasts: [{ latitude: 0, longitude: 0, fetchedAt: null }] },
      // A coordinate off the Earth means the response is not describing our Grid.
      { ...validBody, forecasts: [{ latitude: 991, longitude: 0, temperatureCelsius: 1, fetchedAt: null }] },
    ]

    for (const body of malformedBodies) {
      // Act & Assert
      expect(() => SnapshotResponseValidator.toSnapshot(body)).toThrow(/formato inesperado/)
    }
  })
})
