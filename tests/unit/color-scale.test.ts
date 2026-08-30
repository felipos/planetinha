import { describe, expect, it } from 'vitest'
import {
  MAX_TEMPERATURE_CELSIUS,
  MIN_TEMPERATURE_CELSIUS,
  NO_DATA_RGB,
  rgbToCss,
  temperatureToCssColor,
  temperatureToRgb,
} from '../../src/domain/color-scale'

describe('temperatureToRgb', () => {
  it('returns the exact color at a control point', () => {
    expect(temperatureToRgb(-40)).toEqual([8, 48, 107])
    expect(temperatureToRgb(40)).toEqual([215, 48, 39])
  })

  it('clamps values outside the domain to the nearest edge color', () => {
    expect(temperatureToRgb(-100)).toEqual(temperatureToRgb(MIN_TEMPERATURE_CELSIUS))
    expect(temperatureToRgb(100)).toEqual(temperatureToRgb(MAX_TEMPERATURE_CELSIUS))
  })

  it('interpolates smoothly between two control points', () => {
    const midpoint = temperatureToRgb(-27.5) // ponto médio entre -40 e -15
    expect(midpoint[0]).toBeGreaterThan(8)
    expect(midpoint[0]).toBeLessThan(107)
  })
})

describe('temperatureToCssColor', () => {
  it('uses the neutral no-data color for null (nunca uma cor da escala)', () => {
    expect(temperatureToCssColor(null)).toBe(rgbToCss(NO_DATA_RGB))
  })

  it('returns a valid rgb() string for a real temperature', () => {
    expect(temperatureToCssColor(20)).toMatch(/^rgb\(\d+, \d+, \d+\)$/)
  })
})
