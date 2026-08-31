/** Lat/long grid spacing fetched from the temperature data source, in degrees. */
export const DEFAULT_GRID_RESOLUTION_DEGREES = 10

/**
 * Automatic re-fetch interval for temperature data. 30 minutes — comfortably below the
 * external API's non-commercial usage limit (10,000 requests/day).
 */
export const TEMPERATURE_REFRESH_INTERVAL_MS = 30 * 60 * 1000
