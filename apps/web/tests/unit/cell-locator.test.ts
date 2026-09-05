import { describe, expect, it } from 'vitest'
import { CellLocator } from '../../src/domain/utils/cell-locator'
import type { Snapshot } from '../../src/domain/models/snapshot'
import { mockSnapshot } from '../fixtures/snapshot.fixture'

function snapshotOf(resolutionDegrees: number, forecasts: Snapshot['forecasts']): Snapshot {
  return {
    ...mockSnapshot,
    forecasts,
    resolutionDegrees,
    coverage: { total: forecasts.length, withData: forecasts.length },
  }
}

describe('CellLocator.findForecast', () => {
  const fourCells = snapshotOf(10, [
    { latitude: 0, longitude: 0, temperatureCelsius: 20, validAt: '2026-01-01T00:00' },
    { latitude: 0, longitude: 10, temperatureCelsius: 22, validAt: '2026-01-01T00:00' },
    { latitude: 10, longitude: 0, temperatureCelsius: 24, validAt: '2026-01-01T00:00' },
    { latitude: 10, longitude: 10, temperatureCelsius: 26, validAt: '2026-01-01T00:00' },
  ])

  it('returns the Grid Point own Forecast when the position is the Grid Point itself', () => {
    // Arrange
    const lookup = CellLocator.buildLookup(fourCells)

    // Act
    const forecast = CellLocator.findForecast(lookup, 0, 0)

    // Assert
    expect(forecast?.temperatureCelsius).toBe(20)
  })

  it('returns the containing Cell own Forecast for a position between Grid Points, blending nothing', () => {
    // Arrange
    const lookup = CellLocator.buildLookup(fourCells)

    // Act
    // A Cell is centred on its Grid Point, so 4°N 4°E falls inside the Cell of 0°N 0°E and
    // 6°N 6°E falls inside the Cell of 10°N 10°E. Neither is an average of anything.
    const nearOrigin = CellLocator.findForecast(lookup, 4, 4)
    const nearOpposite = CellLocator.findForecast(lookup, 6, 6)

    // Assert
    expect(nearOrigin?.temperatureCelsius).toBe(20)
    expect(nearOpposite?.temperatureCelsius).toBe(26)
  })

  it('reports the containing Cell Grid Point coordinates, not the position given', () => {
    // Arrange
    const lookup = CellLocator.buildLookup(fourCells)

    // Act
    const cell = CellLocator.cellFor(lookup, 3.7, 6.2)

    // Assert
    expect(cell).toEqual({ latitude: 0, longitude: 10 })
  })

  it('keeps a Cell with No Data as No Data, never filling it in from a neighbour', () => {
    // Arrange
    const withGap = snapshotOf(10, [
      { latitude: 0, longitude: 0, temperatureCelsius: null, validAt: '2026-01-01T00:00' },
      { latitude: 0, longitude: 10, temperatureCelsius: 22, validAt: '2026-01-01T00:00' },
    ])
    const lookup = CellLocator.buildLookup(withGap)

    // Act
    const forecast = CellLocator.findForecast(lookup, 1, 1)

    // Assert
    expect(forecast?.temperatureCelsius).toBeNull()
  })

  it('returns null for a Cell the Snapshot does not describe', () => {
    // Arrange
    const lookup = CellLocator.buildLookup(fourCells)

    // Act
    const forecast = CellLocator.findForecast(lookup, -80, -170)

    // Assert
    expect(forecast).toBeNull()
  })

  it('locates the poles, so the top and bottom of the globe are covered like anywhere else', () => {
    // Arrange
    const poles = snapshotOf(5, [
      { latitude: 90, longitude: 0, temperatureCelsius: -31.4, validAt: '2026-01-01T00:00' },
      { latitude: -90, longitude: 0, temperatureCelsius: -55.1, validAt: '2026-01-01T00:00' },
    ])
    const lookup = CellLocator.buildLookup(poles)

    // Act
    const north = CellLocator.findForecast(lookup, 89.6, 0)
    const south = CellLocator.findForecast(lookup, -88.2, 1)

    // Assert
    expect(north?.temperatureCelsius).toBe(-31.4)
    expect(south?.temperatureCelsius).toBe(-55.1)
  })

  it('handles longitude wraparound across the antimeridian', () => {
    // Arrange
    const acrossTheDateLine = snapshotOf(10, [
      { latitude: 0, longitude: -180, temperatureCelsius: 12, validAt: '2026-01-01T00:00' },
    ])
    const lookup = CellLocator.buildLookup(acrossTheDateLine)

    // Act
    const forecast = CellLocator.findForecast(lookup, 0, 178)

    // Assert
    // 178°E is nearer the antimeridian than 175°E, and the antimeridian is stored as -180.
    expect(forecast?.temperatureCelsius).toBe(12)
  })
})

describe('CellLocator.roundCoordinate / wrapLongitude', () => {
  it('rounds coordinates to a stable precision', () => {
    // Arrange & Act & Assert
    expect(CellLocator.roundCoordinate(10.00000000001)).toBe(10)
  })

  it('wraps longitudes outside [-180, 180) back into range', () => {
    // Arrange & Act & Assert
    expect(CellLocator.wrapLongitude(190)).toBe(-170)
    expect(CellLocator.wrapLongitude(-190)).toBe(170)
  })
})
