import { useCallback, useMemo, useState } from 'react'
import { createSelectPointUseCase } from '../../application/select-point.usecase'
import type { SelectedPoint } from '../../domain/selected-point'
import type { TemperatureGrid } from '../../domain/temperature-grid'

export interface UseSelectedPointResult {
  readonly selectedPoint: SelectedPoint | null
  selectPoint(latitude: number, longitude: number): void
  clearSelection(): void
}

/** Deriva o ponto selecionado (US3) a partir do clique/toque no globo + a grade atual. */
export function useSelectedPoint(grid: TemperatureGrid | null): UseSelectedPointResult {
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null)
  const selectPointUseCase = useMemo(() => createSelectPointUseCase(), [])

  const selectPoint = useCallback(
    (latitude: number, longitude: number) => {
      if (grid === null) {
        return
      }
      setSelectedPoint(selectPointUseCase.execute(grid, latitude, longitude))
    },
    [grid, selectPointUseCase],
  )

  const clearSelection = useCallback(() => {
    setSelectedPoint(null)
  }, [])

  return { selectedPoint, selectPoint, clearSelection }
}
