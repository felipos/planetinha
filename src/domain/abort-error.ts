/**
 * Identifica a rejeição produzida por um `AbortSignal` disparado (`AbortController.abort()`).
 * Checa `.name` em vez de `instanceof DOMException`: em alguns runtimes (ex.: jsdom nos testes)
 * o `DOMException` global do ambiente é um construtor diferente do usado internamente pelo
 * `AbortController` para compor o motivo default do abort, então `instanceof` falsearia negativo.
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}
