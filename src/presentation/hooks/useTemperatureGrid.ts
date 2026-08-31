import { useEffect, useState } from 'react'
import { TEMPERATURE_REFRESH_INTERVAL_MS } from '../../application/config'
import type { FetchTemperatureGridUseCase } from '../../application/fetch-temperature-grid.usecase'
import { isAbortError } from '../../domain/abort-error'
import type { DataFetchStatus } from '../../domain/data-fetch-status'

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Erro desconhecido ao buscar dados de temperatura.'
}

/**
 * Busca a grade de temperatura ao montar e expõe o estado de carregamento/erro (US1), com
 * re-busca automática a cada `TEMPERATURE_REFRESH_INTERVAL_MS` (US4, ver research.md §6). Uma
 * falha no refresh nunca limpa os dados já exibidos: o status vai para `stale-error`
 * preservando `lastGood`, em vez de voltar para `loading`/`hard-error`.
 *
 * Quando a busca só falha PARCIALMENTE (algumas regiões da grade vieram, outras não —
 * `grid.readings.length < grid.expectedPointCount`), o status vira `partial-success` em vez de
 * `success`: mostra o grid recém-buscado mesmo incompleto (em vez de descartá-lo por causa de
 * uma falha que não foi total), com a porcentagem de cobertura para informar o usuário.
 *
 * Um `AbortController` por execução do efeito garante que uma busca obsoleta (ex.: o
 * double-invoke do `StrictMode` em dev — mount → cleanup → mount — ou uma desmontagem real) seja
 * de fato cancelada em vez de só ter seu resultado ignorado: sem isso, o `fetch`/backoff
 * continuaria em segundo plano gastando cota da API à toa.
 */
export function useTemperatureGrid(
  fetchTemperatureGridUseCase: FetchTemperatureGridUseCase,
): DataFetchStatus {
  const [status, setStatus] = useState<DataFetchStatus>({ kind: 'idle' })

  useEffect(() => {
    const controller = new AbortController()

    async function load(): Promise<void> {
      // Mantém a última visualização válida (success, partial-success ou stale-error) visível
      // durante um refresh silencioso em segundo plano; só mostra "loading" quando ainda não há
      // dado nenhum para exibir.
      setStatus((previous) =>
        previous.kind === 'success' || previous.kind === 'partial-success' || previous.kind === 'stale-error'
          ? previous
          : { kind: 'loading' },
      )
      try {
        const grid = await fetchTemperatureGridUseCase.execute(controller.signal)
        if (grid.readings.length < grid.expectedPointCount) {
          const coveragePercent =
            grid.expectedPointCount === 0 ? 100 : Math.round((grid.readings.length / grid.expectedPointCount) * 100)
          setStatus({ kind: 'partial-success', grid, coveragePercent })
        } else {
          setStatus({ kind: 'success', grid })
        }
      } catch (error) {
        if (isAbortError(error)) {
          // Cancelamento intencional, não uma falha real — não deve virar erro para o usuário.
          return
        }
        const errorMessage = describeError(error)
        setStatus((previous) => {
          if (previous.kind === 'success' || previous.kind === 'partial-success') {
            return { kind: 'stale-error', lastGood: previous.grid, errorMessage }
          }
          if (previous.kind === 'stale-error') {
            return { kind: 'stale-error', lastGood: previous.lastGood, errorMessage }
          }
          return { kind: 'hard-error', errorMessage }
        })
      }
    }

    void load()
    const intervalId = window.setInterval(() => {
      void load()
    }, TEMPERATURE_REFRESH_INTERVAL_MS)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [fetchTemperatureGridUseCase])

  return status
}
