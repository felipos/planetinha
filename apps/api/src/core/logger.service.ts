import pino, { type Logger as PinoInstance } from 'pino'
import { injectable } from 'tsyringe'

/** Structured fields attached to a log line, so an operator can filter by Sweep or Slice. */
export type LogFields = Readonly<Record<string, unknown>>

/**
 * Structured logging for both processes, on the same library Fastify already logs through, so
 * the api's request lines and the worker's Sweep lines read the same way.
 */
@injectable()
export class Logger {
  private readonly instance: PinoInstance = pino()

  info(message: string, fields?: LogFields): void {
    this.instance.info(fields ?? {}, message)
  }

  warn(message: string, fields?: LogFields): void {
    this.instance.warn(fields ?? {}, message)
  }

  error(message: string, fields?: LogFields): void {
    this.instance.error(fields ?? {}, message)
  }
}
