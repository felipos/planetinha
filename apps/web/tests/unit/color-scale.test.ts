import { describe, expect, it } from 'vitest'
import { ColorScale } from '../../src/domain/utils/color-scale'

describe('ColorScale.temperatureToRgb', () => {
  it('returns the exact color at a control point', () => {
    expect(ColorScale.temperatureToRgb(-40)).toEqual([8, 48, 107])
    expect(ColorScale.temperatureToRgb(40)).toEqual([215, 48, 39])
  })

  it('clamps values outside the domain to the nearest edge color', () => {
    expect(ColorScale.temperatureToRgb(-100)).toEqual(
      ColorScale.temperatureToRgb(ColorScale.MIN_TEMPERATURE_CELSIUS),
    )
    expect(ColorScale.temperatureToRgb(100)).toEqual(
      ColorScale.temperatureToRgb(ColorScale.MAX_TEMPERATURE_CELSIUS),
    )
  })

  it('interpolates smoothly between two control points', () => {
    const midpoint = ColorScale.temperatureToRgb(-27.5) // midpoint between -40 and -15
    expect(midpoint[0]).toBeGreaterThan(8)
    expect(midpoint[0]).toBeLessThan(107)
  })
})

describe('ColorScale.temperatureToCssColor', () => {
  it('uses the neutral no-data color for null (never a scale color)', () => {
    expect(ColorScale.temperatureToCssColor(null)).toBe(ColorScale.rgbToCss(ColorScale.NO_DATA_RGB))
  })

  it('returns a valid rgb() string for a real temperature', () => {
    expect(ColorScale.temperatureToCssColor(20)).toMatch(/^rgb\(\d+, \d+, \d+\)$/)
  })
})
