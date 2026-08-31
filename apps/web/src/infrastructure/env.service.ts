/**
 * Typed, autocompletable access to environment variables exposed by Vite (`import.meta.env`).
 * Add a getter here whenever a new variable is introduced, instead of reading
 * `import.meta.env` directly anywhere else in the codebase.
 */
export class Env {
  static get OPEN_METEO_FORECAST_URL(): string {
    return Env.required('VITE_OPEN_METEO_FORECAST_URL', import.meta.env.VITE_OPEN_METEO_FORECAST_URL)
  }

  private static required(key: string, value: string | undefined): string {
    if (value === undefined || value.length === 0) {
      throw new Error(`Missing required environment variable: ${key}. See .env.example.`)
    }
    return value
  }
}
