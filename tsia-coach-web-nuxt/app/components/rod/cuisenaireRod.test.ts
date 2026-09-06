// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CuisenaireRod from './CuisenaireRod.vue'
import type { RodProps } from './rod.types'

const props: RodProps = {
    dimensions: { width: 5, depth: 2, height: 3 },
    unitSize: 18,
    appearance: { fill: '#f2c94c', ink: '#2a2200' },
    label: 'five units',
}

describe('CuisenaireRod', () => {
    it('sets the pixel width from the width in units and unit size', () => {
        const wrapper = mount(CuisenaireRod, { props })

        // Happy DOM has no layout engine; check the value supplied to CSS width.
        expect(wrapper.element.style.getPropertyValue('--w')).toBe('90px')
    })

    it('renders the supplied label visibly', () => {
        const wrapper = mount(CuisenaireRod, { props })
        const label = wrapper.findAll('span').find(span => span.text() === 'five units')

        expect(label?.isVisible()).toBe(true)
    })
})
