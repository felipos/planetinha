import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { TemperatureLegend } from '../../src/presentation/components/temperature-legend/temperature-legend.component'

describe('TemperatureLegend', () => {
  it('shows a textual label for every color stop (never relies on color alone)', () => {
    const { getByText } = render(<TemperatureLegend />)
    expect(getByText('-40°C')).toBeInTheDocument()
    expect(getByText('40°C')).toBeInTheDocument()
  })

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<TemperatureLegend />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
