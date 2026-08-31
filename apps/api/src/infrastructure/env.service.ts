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
