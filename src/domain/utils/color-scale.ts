export interface ColorStop {
  readonly celsius: number
  readonly rgb: readonly [number, number, number]
}

/**
 * Diverging color scale for the temperature gradient. Manual implementation (no
 * d3-scale-chromatic) with a few control points interpolated linearly in RGB: deep blue → light
 * blue → yellow → orange → red.
 */
export class ColorScale {
  static readonly TEMPERATURE_COLOR_STOPS: readonly ColorStop[] = [
    { celsius: -40, rgb: [8, 48, 107] }, // deep blue
    { celsius: -15, rgb: [107, 174, 214] }, // light blue
    { celsius: 10, rgb: [254, 224, 139] }, // yellow
    { celsius: 25, rgb: [252, 141, 89] }, // orange
    { celsius: 40, rgb: [215, 48, 39] }, // red
  ]

  // Mirrors the first/last control point of TEMPERATURE_COLOR_STOPS above. Kept as a literal
  // (instead of indexing the array) to avoid a possibly-`undefined` access under
  // `noUncheckedIndexedAccess`.
  static readonly MIN_TEMPERATURE_CELSIUS = -40
  static readonly MAX_TEMPERATURE_CELSIUS = 40

  /** Color used for points with no data available — never a scale color (never misleading). */
  static readonly NO_DATA_RGB: readonly [number, number, number] = [148, 148, 148]

  /** Converts a temperature in Celsius to RGB (0-255), clamped at the domain edges. */
  static temperatureToRgb(celsius: number): readonly [number, number, number] {
    const clamped = Math.min(
      Math.max(celsius, ColorScale.MIN_TEMPERATURE_CELSIUS),
      ColorScale.MAX_TEMPERATURE_CELSIUS,
    )

    let lowerIndex = 0
    for (let i = 0; i < ColorScale.TEMPERATURE_COLOR_STOPS.length - 1; i += 1) {
      const current = ColorScale.TEMPERATURE_COLOR_STOPS[i]
      const next = ColorScale.TEMPERATURE_COLOR_STOPS[i + 1]
      if (current === undefined || next === undefined) {
        continue
      }
      if (clamped >= current.celsius && clamped <= next.celsius) {
        lowerIndex = i
        break
      }
    }

    const lower = ColorScale.TEMPERATURE_COLOR_STOPS[lowerIndex]
    const upper = ColorScale.TEMPERATURE_COLOR_STOPS[lowerIndex + 1]
    if (lower === undefined || upper === undefined) {
      return ColorScale.NO_DATA_RGB
    }

    const span = upper.celsius - lower.celsius
    const t = span === 0 ? 0 : (clamped - lower.celsius) / span

    return [
      Math.round(ColorScale.lerp(lower.rgb[0], upper.rgb[0], t)),
      Math.round(ColorScale.lerp(lower.rgb[1], upper.rgb[1], t)),
      Math.round(ColorScale.lerp(lower.rgb[2], upper.rgb[2], t)),
    ]
  }

  static rgbToCss(rgb: readonly [number, number, number]): string {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
  }

  /** CSS color for a temperature, or the "no data" color when `celsius` is `null`. */
  static temperatureToCssColor(celsius: number | null): string {
    if (celsius === null) {
      return ColorScale.rgbToCss(ColorScale.NO_DATA_RGB)
    }
    return ColorScale.rgbToCss(ColorScale.temperatureToRgb(celsius))
  }

  private static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }
}
