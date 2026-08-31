import type { TemperatureReading } from './temperature-reading'

export class TemperatureReadingValidator {
  static isValidLatitude(latitude: number): boolean {
    return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
  }

  static isValidLongitude(longitude: number): boolean {
    return Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
  }

  static isValidReading(reading: TemperatureReading): boolean {
    if (!TemperatureReadingValidator.isValidLatitude(reading.latitude)) {
      return false
    }
    if (!TemperatureReadingValidator.isValidLongitude(reading.longitude)) {
      return false
    }
    if (reading.temperatureCelsius !== null && !Number.isFinite(reading.temperatureCelsius)) {
      return false
    }
    return true
  }
}
