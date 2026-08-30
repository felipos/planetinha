import { describe, expect, it } from 'vitest'
import { buildGridLookup, interpolateTemperatureAt, roundCoord, wrapLongitude } from '../../src/domain/interpolation'
import type { TemperatureGrid } from '../../src/domain/temperature-grid'

function grid(resolutionDegrees: number, readings: TemperatureGrid['readings']): TemperatureGrid {
  return { readings, fetchedAt: '2026-01-01T00:00:00Z', resolutionDegrees }
}

describe('interpolateTemperatureAt', () => {
  const fourCorners = grid(10, [
    { latitude: 0, longitude: 0, temperatureCelsius: 20, observedAt: '2026-01-01T00:00' },
    { latitude: 0, longitude: 10, temperatureCelsius: 22, observedAt: '2026-01-01T00:00' },
    { latitude: 10, longitude: 0, temperatureCelsius: 24, observedAt: '2026-01-01T00:00' },
    { latitude: 10, longitude: 10, temperatureCelsius: 26, observedAt: '2026-01-01T00:00' },
  ])

  it('returns the exact reading (isInterpolated: false) when the point matches a grid cell', () => {
    const lookup = buildGridLookup(fourCorners)
    const result = interpolateTemperatureAt(lookup, 0, 0)
    expect(result).toEqual({ temperatureCelsius: 20, isInterpolated: false })
  })

  it('interpolates a value between the 4 surrounding corners for an arbitrary point', () => {
    const lookup = buildGridLookup(fourCorners)
    const result = interpolateTemperatureAt(lookup, 5, 5)
    expect(result.isInterpolated).toBe(true)
    // Ponto equidistante dos 4 cantos (IDW) ~= média simples dos 4 valores.
    expect(result.temperatureCelsius).toBeCloseTo(23, 0)
  })

  it('excludes neighbors without data from the weighted average, never inventing a value', () => {
    const gridWithGap = grid(10, [
      { latitude: 0, longitude: 0, temperatureCelsius: null, observedAt: '2026-01-01T00:00' },
      { latitude: 0, longitude: 10, temperatureCelsius: 22, observedAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: 0, temperatureCelsius: 24, observedAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: 10, temperatureCelsius: 26, observedAt: '2026-01-01T00:00' },
    ])
    const lookup = buildGridLookup(gridWithGap)
    const result = interpolateTemperatureAt(lookup, 5, 5)
    expect(result.temperatureCelsius).not.toBeNull()
    expect(Number.isNaN(result.temperatureCelsius)).toBe(false)
  })

  it('returns null when no surrounding neighbor has data ("sem dado", nunca um valor inventado)', () => {
    const allNullGrid = grid(10, [
      { latitude: 0, longitude: 0, temperatureCelsius: null, observedAt: '2026-01-01T00:00' },
      { latitude: 0, longitude: 10, temperatureCelsius: null, observedAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: 0, temperatureCelsius: null, observedAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: 10, temperatureCelsius: null, observedAt: '2026-01-01T00:00' },
    ])
    const lookup = buildGridLookup(allNullGrid)
    const result = interpolateTemperatureAt(lookup, 5, 5)
    expect(result.temperatureCelsius).toBeNull()
  })

  it('handles longitude wraparound across the antimeridian', () => {
    const dateLineGrid = grid(10, [
      { latitude: 0, longitude: 170, temperatureCelsius: 10, observedAt: '2026-01-01T00:00' },
      { latitude: 0, longitude: -180, temperatureCelsius: 12, observedAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: 170, temperatureCelsius: 14, observedAt: '2026-01-01T00:00' },
      { latitude: 10, longitude: -180, temperatureCelsius: 16, observedAt: '2026-01-01T00:00' },
    ])
    const lookup = buildGridLookup(dateLineGrid)
    const result = interpolateTemperatureAt(lookup, 5, 175)
    expect(result.temperatureCelsius).not.toBeNull()
  })
})

describe('roundCoord / wrapLongitude', () => {
  it('rounds coordinates to a stable precision', () => {
    expect(roundCoord(10.00000000001)).toBe(10)
  })

  it('wraps longitudes outside [-180, 180) back into range', () => {
    expect(wrapLongitude(190)).toBe(-170)
    expect(wrapLongitude(-190)).toBe(170)
  })
})
