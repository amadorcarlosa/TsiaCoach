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

    it('extrudes six faces and keeps its height when raised', () => {
        const wrapper = mount(CuisenaireRod, { props })
        const rod = wrapper.get('.rod')

        expect(rod.attributes('data-rod-presentation')).toBe('raised')
        expect(wrapper.findAll('.face')).toHaveLength(6)
        expect(rod.attributes('style')).toContain('--h: 54px')
        expect(wrapper.get('[data-rod-surface]').classes()).toEqual(['face', 'top'])
    })

    it('keeps colour, label, footprint and hit target but drops every face when flat', () => {
        const wrapper = mount(CuisenaireRod, {
            props: { ...props, presentation: 'flat' },
        })

        const rod = wrapper.get('.rod')
        const style = rod.attributes('style') ?? ''

        expect(rod.attributes('data-rod-presentation')).toBe('flat')
        expect(wrapper.findAll('.face')).toHaveLength(0)

        // No extrusion to project: zero height, so no upward offset either.
        expect(style).toContain('--h: 0px')
        expect(style).toContain('--w: 90px')
        expect(style).toContain('--d: 36px')
        expect(style).toContain('--fill: #f2c94c')
        expect(rod.attributes('data-width-px')).toBe('90')

        const surface = wrapper.get('[data-rod-surface]')
        expect(wrapper.findAll('[data-rod-surface]')).toHaveLength(1)
        expect(surface.text()).toBe('five units')
    })
})
