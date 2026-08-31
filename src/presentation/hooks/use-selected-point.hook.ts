import { useCallback, useState } from 'react'
import type { SelectPointUseCase } from '../../application/select-point.use-case'
import type { SelectedPoint } from '../../domain/selected-point'
import type { TemperatureGrid } from '../../domain/temperature-grid'

export interface UseSelectedPointResult {
  readonly selectedPoint: SelectedPoint | null
  selectPoint(latitude: number, longitude: number): void
  clearSelection(): void
}

/** Derives the selected point from a click/tap on the globe plus the current grid. */
export function useSelectedPoint(
  grid: TemperatureGrid | null,
  selectPointUseCase: SelectPointUseCase,
): UseSelectedPointResult {
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null)

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
