import pino, { type Logger } from 'pino'
import { injectable } from 'tsyringe'
import type { LogFields, LoggerPort } from '../application/ports/logger.port'

/**
 * Structured logging for both processes, on the same library Fastify already logs through, so
 * the api's request lines and the worker's Sweep lines read the same way.
 */
@injectable()
export class PinoLogger implements LoggerPort {
  private readonly logger: Logger = pino()

  info(message: string, fields?: LogFields): void {
    this.logger.info(fields ?? {}, message)
  }

  warn(message: string, fields?: LogFields): void {
    this.logger.warn(fields ?? {}, message)
  }

  error(message: string, fields?: LogFields): void {
    this.logger.error(fields ?? {}, message)
  }
}
