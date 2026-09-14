import type { Forecast } from '../models/forecast'

export class ForecastValidator {
  static isValidLatitude(latitude: number): boolean {
    return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
  }

  static isValidLongitude(longitude: number): boolean {
    return Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
  }

  static isValidForecast(forecast: Forecast): boolean {
    if (!ForecastValidator.isValidLatitude(forecast.latitude)) {
      return false
    }
    if (!ForecastValidator.isValidLongitude(forecast.longitude)) {
      return false
    }
    if (forecast.temperatureCelsius !== null && !Number.isFinite(forecast.temperatureCelsius)) {
      return false
    }
    return true
  }
}
