/** Structured fields attached to a log line, so an operator can filter by Sweep or Slice. */
export type LogFields = Readonly<Record<string, unknown>>

/**
 * Port (dependency-inversion seam) for structured logging. Kept a port so a use case can say
 * what happened without depending on which logger the process was started with.
 */
export interface LoggerPort {
  info(message: string, fields?: LogFields): void
  warn(message: string, fields?: LogFields): void
  error(message: string, fields?: LogFields): void
}
