import { ColorScale } from '../../../domain/utils/color-scale'
import './temperature-legend.css'

const TEMPERATURE_SPAN = ColorScale.MAX_TEMPERATURE_CELSIUS - ColorScale.MIN_TEMPERATURE_CELSIUS

export function TemperatureLegend() {
  const gradientStops = ColorScale.TEMPERATURE_COLOR_STOPS.map((stop) => {
    const percent = ((stop.celsius - ColorScale.MIN_TEMPERATURE_CELSIUS) / TEMPERATURE_SPAN) * 100
    return `${ColorScale.rgbToCss(stop.rgb)} ${percent}%`
  }).join(', ')

  return (
    <div className="legend" aria-label="Legenda de temperatura, de mais frio a mais quente">
      <div
        className="legend__bar"
        style={{ backgroundImage: `linear-gradient(to right, ${gradientStops})` }}
      />
      <ul className="legend__labels">
        {ColorScale.TEMPERATURE_COLOR_STOPS.map((stop) => (
          <li key={stop.celsius} className="legend__label">
            {stop.celsius}°C
          </li>
        ))}
      </ul>
    </div>
  )
}
