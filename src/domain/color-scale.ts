/**
 * Escala de cor diverging para o gradiente de temperatura (ver research.md §4).
 * Implementação manual (sem d3-scale-chromatic) com poucos pontos de controle interpolados
 * linearmente em RGB: azul profundo → azul claro → amarelo → laranja → vermelho.
 */

export interface ColorStop {
  readonly celsius: number
  readonly rgb: readonly [number, number, number]
}

export const TEMPERATURE_COLOR_STOPS: readonly ColorStop[] = [
  { celsius: -40, rgb: [8, 48, 107] }, // azul profundo
  { celsius: -15, rgb: [107, 174, 214] }, // azul claro
  { celsius: 10, rgb: [254, 224, 139] }, // amarelo
  { celsius: 25, rgb: [252, 141, 89] }, // laranja
  { celsius: 40, rgb: [215, 48, 39] }, // vermelho
]

// Espelha o primeiro/último ponto de controle de TEMPERATURE_COLOR_STOPS acima.
// Mantido como literal (em vez de indexar o array) para evitar acesso possivelmente
// `undefined` sob `noUncheckedIndexedAccess`.
export const MIN_TEMPERATURE_CELSIUS = -40
export const MAX_TEMPERATURE_CELSIUS = 40

/** Cor usada para pontos sem dado disponível — nunca uma cor da escala (nunca enganosa). */
export const NO_DATA_RGB: readonly [number, number, number] = [148, 148, 148]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Converte uma temperatura em Celsius para RGB (0-255), com clamp nas bordas do domínio. */
export function temperatureToRgb(celsius: number): readonly [number, number, number] {
  const clamped = Math.min(Math.max(celsius, MIN_TEMPERATURE_CELSIUS), MAX_TEMPERATURE_CELSIUS)

  let lowerIndex = 0
  for (let i = 0; i < TEMPERATURE_COLOR_STOPS.length - 1; i += 1) {
    const current = TEMPERATURE_COLOR_STOPS[i]
    const next = TEMPERATURE_COLOR_STOPS[i + 1]
    if (current === undefined || next === undefined) {
      continue
    }
    if (clamped >= current.celsius && clamped <= next.celsius) {
      lowerIndex = i
      break
    }
  }

  const lower = TEMPERATURE_COLOR_STOPS[lowerIndex]
  const upper = TEMPERATURE_COLOR_STOPS[lowerIndex + 1]
  if (lower === undefined || upper === undefined) {
    return NO_DATA_RGB
  }

  const span = upper.celsius - lower.celsius
  const t = span === 0 ? 0 : (clamped - lower.celsius) / span

  return [
    Math.round(lerp(lower.rgb[0], upper.rgb[0], t)),
    Math.round(lerp(lower.rgb[1], upper.rgb[1], t)),
    Math.round(lerp(lower.rgb[2], upper.rgb[2], t)),
  ]
}

export function rgbToCss(rgb: readonly [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

/** Cor CSS para uma temperatura, ou a cor de "sem dado" quando `celsius` é `null`. */
export function temperatureToCssColor(celsius: number | null): string {
  if (celsius === null) {
    return rgbToCss(NO_DATA_RGB)
  }
  return rgbToCss(temperatureToRgb(celsius))
}
