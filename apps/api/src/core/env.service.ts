/**
 * Typed, autocompletable access to environment variables. Add a getter here whenever a new
 * variable is introduced, instead of reading `process.env` directly anywhere else in the
 * package. See `.env.example` for the keys and where each one is set.
 */
export class Env {
  static get PORT(): number {
    return Env.optionalNumber('PORT', 3000)
  }

  /** `0.0.0.0` rather than `localhost`, so the port is reachable from outside the container. */
  static get HOST(): string {
    return process.env.HOST ?? '0.0.0.0'
  }

  /**
   * Necessarily has two different values: host tooling reaches Postgres on the published port,
   * a container reaches it by service name. The host value lives in `apps/api/.env`, the
   * container value in `compose.yaml` — kept apart so neither context can read the other's.
   */
  static get DATABASE_URL(): string {
    return Env.required('DATABASE_URL')
  }

  /** The upstream weather provider's forecast endpoint — the only URL the api fetches from. */
  static get OPEN_METEO_FORECAST_URL(): string {
    return Env.required('OPEN_METEO_FORECAST_URL')
  }

  /**
   * How many Grid Points one Slice covers. 100 is the most coordinates the provider accepts in
   * one call, which makes the Grid 26 Slices; lower it if measured Rate Limit responses say the
   * pace is too fast.
   */
  static get SLICE_SIZE(): number {
    return Env.optionalNumber('SLICE_SIZE', 100)
  }

  /** How long the worker waits between Ticks. One Slice is advanced per Tick, at most. */
  static get TICK_INTERVAL_MS(): number {
    return Env.optionalNumber('TICK_INTERVAL_MS', 60_000)
  }

  /** How long after a Sweep starts the next one becomes due. Twice a day is 12 hours. */
  static get SWEEP_INTERVAL_MS(): number {
    return Env.optionalNumber('SWEEP_INTERVAL_MS', 12 * 60 * 60 * 1_000)
  }

  protected static required(key: string): string {
    const value = process.env[key]
    if (value === undefined || value.length === 0) {
      throw new Error(`Missing required environment variable: ${key}. See apps/api/.env.example.`)
    }
    return value
  }

  protected static optionalNumber(key: string, fallback: number): number {
    const raw = process.env[key]
    if (raw === undefined || raw.length === 0) {
      return fallback
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      throw new Error(`Environment variable ${key} must be a number, got "${raw}".`)
    }
    return parsed
  }
}
