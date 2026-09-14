import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PoleExpansion } from '../../src/domain/utils/pole-expansion'

describe('PoleExpansion', () => {
  it('reports the expanded point count the wire format describes, poles included at every longitude', () => {
    // Arrange & Act
    const expanded = PoleExpansion.count()

    // Assert
    assert.equal(expanded, 2_664)
  })

  it('identifies only the two poles as poles', () => {
    // Arrange & Act & Assert
    assert.equal(PoleExpansion.isPole(90), true)
    assert.equal(PoleExpansion.isPole(-90), true)
    assert.equal(PoleExpansion.isPole(0), false)
    assert.equal(PoleExpansion.isPole(89.9), false)
  })

  it('expands a stored pole to one entry per longitude column, keeping its other fields', () => {
    // Arrange
    const pole = { latitude: 90, longitude: 0, temperatureCelsius: -31.4 }

    // Act
    const expanded = PoleExpansion.expand(pole)

    // Assert
    assert.equal(expanded.length, 72)
    assert.ok(expanded.every((point) => point.latitude === 90 && point.temperatureCelsius === -31.4))
    assert.equal(new Set(expanded.map((point) => point.longitude)).size, 72)
  })
})
