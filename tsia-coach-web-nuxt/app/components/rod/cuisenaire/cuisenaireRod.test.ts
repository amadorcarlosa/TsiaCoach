// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CuisenaireRod from './CuisenaireRod.vue'
import type { RodProps } from "~/components/rod/rod.types.ts";

const props: RodProps = {
    dimensions: { width: 5, depth: 2, height: 3 },
    unitSize: 18,
    appearance: { fill: '#f2c94c', ink: '#2a2200' },
    label: 'five units',
}

describe('CuisenaireRod', () => {
    it('reports the pixel width from the width in units and unit size', () => {
        const wrapper = mount(CuisenaireRod, { props })

        expect(wrapper.attributes('data-width-px')).toBe('90')
    })

    it('renders the supplied label', () => {
        const wrapper = mount(CuisenaireRod, { props })

        expect(wrapper.text()).toContain('five units')
    })
})
