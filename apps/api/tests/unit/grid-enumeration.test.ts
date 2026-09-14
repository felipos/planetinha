import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { GRID_RESOLUTION_DEGREES } from '../../src/core/config'
import { GridEnumerator } from '../../src/domain/utils/grid-enumeration'

describe('GridEnumerator', () => {
  it('enumerates 2,522 Grid Points at 5° Resolution, with each pole deduplicated', () => {
    // Arrange
    const longitudeColumns = 360 / GRID_RESOLUTION_DEGREES

    // Act
    const points = GridEnumerator.enumerate()

    // Assert
    // 37 latitude rows × 72 longitude columns is 2,664; storing each pole once instead of 72
    // times removes 142 of them, saving that many upstream calls per Sweep.
    assert.equal(points.length, 37 * longitudeColumns - 2 * (longitudeColumns - 1))
    assert.equal(points.length, 2_522)
  })

  it('holds each pole exactly once', () => {
    // Arrange & Act
    const points = GridEnumerator.enumerate()

    // Assert
    assert.deepEqual(
      points.filter((point) => point.latitude === 90),
      [{ latitude: 90, longitude: 0 }],
    )
    assert.deepEqual(
      points.filter((point) => point.latitude === -90),
      [{ latitude: -90, longitude: 0 }],
    )
  })

  it('covers the whole Earth with no duplicated position', () => {
    // Arrange & Act
    const points = GridEnumerator.enumerate()

    // Assert
    const positions = new Set(points.map((point) => `${point.latitude}|${point.longitude}`))
    assert.equal(positions.size, points.length)
    assert.ok(points.every((point) => point.latitude >= -90 && point.latitude <= 90))
    assert.ok(points.every((point) => point.longitude >= -180 && point.longitude < 180))
  })
})
