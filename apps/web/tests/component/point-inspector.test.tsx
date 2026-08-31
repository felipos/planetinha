import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { PointInspector } from '../../src/presentation/components/point-inspector/point-inspector.component'
import type { SelectedPoint } from '../../src/domain/selected-point'

const samplePoint: SelectedPoint = {
  latitude: 10,
  longitude: -40,
  temperatureCelsius: 24.3,
  isInterpolated: false,
}

describe('PointInspector', () => {
  it('renders nothing when there is no selected point', () => {
    const { container } = render(<PointInspector point={null} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the numeric temperature (never relies on color alone)', () => {
    const { getByText } = render(<PointInspector point={samplePoint} onClose={() => {}} />)
    expect(getByText('24.3 °C')).toBeInTheDocument()
  })

  it('shows a distinct message when there is no data for the point', () => {
    const { getByText } = render(
      <PointInspector point={{ ...samplePoint, temperatureCelsius: null }} onClose={() => {}} />,
    )
    expect(getByText('Sem dado disponível para este ponto')).toBeInTheDocument()
  })

  it('closes on Escape (dismissible via keyboard)', () => {
    const onClose = vi.fn()
    render(<PointInspector point={samplePoint} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<PointInspector point={samplePoint} onClose={() => {}} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
