import { describe, expect, it } from 'vitest'
import { TemperatureInterpolator } from '../../src/domain/utils/interpolation'
import type { TemperatureGrid } from '../../src/domain/temperature-grid'

function grid(resolutionDegrees: number, readings: TemperatureGrid['readings']): TemperatureGrid {
  return {
    readings,
    fetchedAt: '2026-01-01T00:00:00Z',
    resolutionDegrees,
    expectedPointCount: readings.length,
  }
}

describe('TemperatureInterpolator.interpolateTemperatureAt', () => {
  const fourCorners = grid(10, [
    { latitude: 0, longitude: 0, temperatureCelsius: 20, observedAt: '2026-01-01T00:00' },
    { latitude: 0, longitude: 10, temperatureCelsius: 22, observedAt: '2026-01-01T00:00' },
    { latitude: 10, longitude: 0, temperatureCelsius: 24, observedAt: '2026-01-01T00:00' },
    { latitude: 10, longitude: 10, temperatureCelsius: 26, observedAt: '2026-01-01T00:00' },
  ])

  it('returns the exact reading (isInterpolated: false) when the point matches a grid cell', () => {
    const lookup = TemperatureInterpolator.buildGridLookup(fourCorners)
    const result = TemperatureInterpolator.interpolateTemperatureAt(lookup, 0, 0)
    expect(result).toEqual({ temperatureCelsius: 20, isInterpolated: false })
  })

  it('interpolates a value between the 4 surrounding corners for an arbitrary point', () => {
    const lookup = TemperatureInterpolator.buildGridLookup(fourCorners)
    const result = TemperatureInterpolator.interpolateTemperatureAt(lookup, 5, 5)
    expect(result.isInterpolated).toBe(true)
    // Point equidistant from the 4 corners (IDW) ~= simple average of the 4 values.
    expect(result.temperatureCelsius).toBeCloseTo(23, 0)
  })

  it('excludes neighbors without data from the weighted average, never inventing a value', () => {
    const gridWithGap = grid(10, [
      { latitude: 0, longitude: 0, temperatureCelsius: null, observedAt: '2026-01-01T00:00' },
      { latitude: 0, longitude: 10, temperatureCelsius: 22, observedAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: 0, temperatureCelsius: 24, observedAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: 10, temperatureCelsius: 26, observedAt: '2026-01-01T00:00' },
    ])
    const lookup = TemperatureInterpolator.buildGridLookup(gridWithGap)
    const result = TemperatureInterpolator.interpolateTemperatureAt(lookup, 5, 5)
    expect(result.temperatureCelsius).not.toBeNull()
    expect(Number.isNaN(result.temperatureCelsius)).toBe(false)
  })

  it('returns null when no surrounding neighbor has data (never a made-up value)', () => {
    const allNullGrid = grid(10, [
      { latitude: 0, longitude: 0, temperatureCelsius: null, observedAt: '2026-01-01T00:00' },
      { latitude: 0, longitude: 10, temperatureCelsius: null, observedAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: 0, temperatureCelsius: null, observedAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: 10, temperatureCelsius: null, observedAt: '2026-01-01T00:00' },
    ])
    const lookup = TemperatureInterpolator.buildGridLookup(allNullGrid)
    const result = TemperatureInterpolator.interpolateTemperatureAt(lookup, 5, 5)
    expect(result.temperatureCelsius).toBeNull()
  })

  it('handles longitude wraparound across the antimeridian', () => {
    const dateLineGrid = grid(10, [
      { latitude: 0, longitude: 170, temperatureCelsius: 10, observedAt: '2026-01-01T00:00' },
      { latitude: 0, longitude: -180, temperatureCelsius: 12, observedAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: 170, temperatureCelsius: 14, observedAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: -180, temperatureCelsius: 16, observedAt: '2026-01-01T00:00' },
    ])
    const lookup = TemperatureInterpolator.buildGridLookup(dateLineGrid)
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
