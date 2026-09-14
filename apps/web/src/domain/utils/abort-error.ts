/**
 * Detects the rejection produced by a triggered `AbortSignal` (`AbortController.abort()`).
 */
export class AbortErrorDetector {
  /**
   * Checks `.name` instead of `instanceof DOMException`: on some runtimes (e.g. jsdom in tests)
   * the environment's global `DOMException` is a different constructor from the one used
   * internally by `AbortController` to build the default abort reason, so `instanceof` would
   * give a false negative there.
   */
  static isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError'
  }
}
