import {
  MAX_TEMPERATURE_CELSIUS,
  MIN_TEMPERATURE_CELSIUS,
  rgbToCss,
  TEMPERATURE_COLOR_STOPS,
} from '../../../domain/color-scale'
import './TemperatureLegend.css'

const TEMPERATURE_SPAN = MAX_TEMPERATURE_CELSIUS - MIN_TEMPERATURE_CELSIUS

export function TemperatureLegend() {
  const gradientStops = TEMPERATURE_COLOR_STOPS.map((stop) => {
    const percent = ((stop.celsius - MIN_TEMPERATURE_CELSIUS) / TEMPERATURE_SPAN) * 100
    return `${rgbToCss(stop.rgb)} ${percent}%`
  }).join(', ')

  return (
    <div className="legend" aria-label="Legenda de temperatura, de mais frio a mais quente">
      <div
        className="legend__bar"
        style={{ backgroundImage: `linear-gradient(to right, ${gradientStops})` }}
      />
      <ul className="legend__labels">
        {TEMPERATURE_COLOR_STOPS.map((stop) => (
          <li key={stop.celsius} className="legend__label">
            {stop.celsius}°C
          </li>
        ))}
      </ul>
    </div>
  )
}
