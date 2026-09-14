/**
 * Detects the rejection produced by a triggered `AbortSignal` (`AbortController.abort()`).
 *
 * Checks `.name` instead of `instanceof DOMException`: the constructor `AbortController` uses
 * internally to build its default abort reason is not always the environment's global one, so
 * `instanceof` can give a false negative.
 */
export class AbortErrorDetector {
  static isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError'
  }
}
