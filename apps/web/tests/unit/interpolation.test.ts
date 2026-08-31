import { describe, expect, it } from 'vitest'
import { TemperatureInterpolator } from '../../src/domain/utils/interpolation'
import type { Snapshot } from '../../src/domain/snapshot'
import { mockSnapshot } from '../fixtures/snapshot.fixture'

function snapshotOf(resolutionDegrees: number, forecasts: Snapshot['forecasts']): Snapshot {
  return {
    ...mockSnapshot,
    forecasts,
    resolutionDegrees,
    coverage: { total: forecasts.length, withData: forecasts.length },
  }
}

describe('TemperatureInterpolator.interpolateTemperatureAt', () => {
  const fourCorners = snapshotOf(10, [
    { latitude: 0, longitude: 0, temperatureCelsius: 20, validAt: '2026-01-01T00:00' },
    { latitude: 0, longitude: 10, temperatureCelsius: 22, validAt: '2026-01-01T00:00' },
    { latitude: 10, longitude: 0, temperatureCelsius: 24, validAt: '2026-01-01T00:00' },
    { latitude: 10, longitude: 10, temperatureCelsius: 26, validAt: '2026-01-01T00:00' },
  ])

  it('returns the exact Forecast (isInterpolated: false) when the point matches a Grid Point', () => {
    const lookup = TemperatureInterpolator.buildCellLookup(fourCorners)
    const result = TemperatureInterpolator.interpolateTemperatureAt(lookup, 0, 0)
    expect(result).toEqual({ temperatureCelsius: 20, isInterpolated: false })
  })

  it('interpolates a value between the 4 surrounding Grid Points for an arbitrary point', () => {
    const lookup = TemperatureInterpolator.buildCellLookup(fourCorners)
    const result = TemperatureInterpolator.interpolateTemperatureAt(lookup, 5, 5)
    expect(result.isInterpolated).toBe(true)
    // Point equidistant from the 4 corners (IDW) ~= simple average of the 4 values.
    expect(result.temperatureCelsius).toBeCloseTo(23, 0)
  })

  it('excludes neighbours with No Data from the weighted average, never inventing a value', () => {
    const snapshotWithGap = snapshotOf(10, [
      { latitude: 0, longitude: 0, temperatureCelsius: null, validAt: '2026-01-01T00:00' },
      { latitude: 0, longitude: 10, temperatureCelsius: 22, validAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: 0, temperatureCelsius: 24, validAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: 10, temperatureCelsius: 26, validAt: '2026-01-01T00:00' },
    ])
    const lookup = TemperatureInterpolator.buildCellLookup(snapshotWithGap)
    const result = TemperatureInterpolator.interpolateTemperatureAt(lookup, 5, 5)
    expect(result.temperatureCelsius).not.toBeNull()
    expect(Number.isNaN(result.temperatureCelsius)).toBe(false)
  })

  it('returns null when no surrounding neighbour has a temperature (never a made-up value)', () => {
    const allNoDataSnapshot = snapshotOf(10, [
      { latitude: 0, longitude: 0, temperatureCelsius: null, validAt: '2026-01-01T00:00' },
      { latitude: 0, longitude: 10, temperatureCelsius: null, validAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: 0, temperatureCelsius: null, validAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: 10, temperatureCelsius: null, validAt: '2026-01-01T00:00' },
    ])
    const lookup = TemperatureInterpolator.buildCellLookup(allNoDataSnapshot)
    const result = TemperatureInterpolator.interpolateTemperatureAt(lookup, 5, 5)
    expect(result.temperatureCelsius).toBeNull()
  })

  it('handles longitude wraparound across the antimeridian', () => {
    const dateLineSnapshot = snapshotOf(10, [
      { latitude: 0, longitude: 170, temperatureCelsius: 10, validAt: '2026-01-01T00:00' },
      { latitude: 0, longitude: -180, temperatureCelsius: 12, validAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: 170, temperatureCelsius: 14, validAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: -180, temperatureCelsius: 16, validAt: '2026-01-01T00:00' },
    ])
    const lookup = TemperatureInterpolator.buildCellLookup(dateLineSnapshot)
    const result = TemperatureInterpolator.interpolateTemperatureAt(lookup, 5, 175)
    expect(result.temperatureCelsius).not.toBeNull()
  })
})

describe('TemperatureInterpolator.roundCoord / wrapLongitude', () => {
  it('rounds coordinates to a stable precision', () => {
    expect(TemperatureInterpolator.roundCoord(10.00000000001)).toBe(10)
  })

  it('wraps longitudes outside [-180, 180) back into range', () => {
    expect(TemperatureInterpolator.wrapLongitude(190)).toBe(-170)
    expect(TemperatureInterpolator.wrapLongitude(-190)).toBe(170)
  })
})
