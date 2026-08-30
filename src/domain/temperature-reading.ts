/**
 * Leitura de temperatura em uma coordenada geográfica (ver data-model.md).
 * `temperatureCelsius: null` representa explicitamente "sem dado disponível" e MUST ser
 * tratado de forma distinta de `0` (zero graus é um valor válido).
 */
export interface TemperatureReading {
  readonly latitude: number
  readonly longitude: number
  readonly temperatureCelsius: number | null
  readonly observedAt: string
}

export function isValidLatitude(latitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
}

export function isValidLongitude(longitude: number): boolean {
  return Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
}

export function isValidTemperatureReading(reading: TemperatureReading): boolean {
  if (!isValidLatitude(reading.latitude)) {
    return false
  }
  if (!isValidLongitude(reading.longitude)) {
    return false
  }
  if (reading.temperatureCelsius !== null && !Number.isFinite(reading.temperatureCelsius)) {
    return false
  }
  return true
}
