import { useCallback, useState } from 'react'
import type { SelectPointUseCase } from '../../domain/usecases/select-point.usecase'
import type { SelectedPoint } from '../../domain/models/selected-point'
import type { Snapshot } from '../../domain/models/snapshot'

export interface UseSelectedPointResult {
  readonly selectedPoint: SelectedPoint | null
  selectPoint(latitude: number, longitude: number): void
  clearSelection(): void
}

/** Derives the selected point from a click/tap on the globe plus the current Snapshot. */
export function useSelectedPoint(
  snapshot: Snapshot | null,
  selectPointUseCase: SelectPointUseCase,
): UseSelectedPointResult {
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null)

  const selectPoint = useCallback(
    (latitude: number, longitude: number) => {
      if (snapshot === null) {
        return
      }
      setSelectedPoint(selectPointUseCase.execute(snapshot, latitude, longitude))
    },
    [snapshot, selectPointUseCase],
  )

  const clearSelection = useCallback(() => {
    setSelectedPoint(null)
  }, [])

  return { selectedPoint, selectPoint, clearSelection }
}
