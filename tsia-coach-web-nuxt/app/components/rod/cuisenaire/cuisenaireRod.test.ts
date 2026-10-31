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

        // A plain flat strip stays undivided; only 'flat-units' draws cells.
        expect(wrapper.findAll('.unit')).toHaveLength(0)
    })

    const units = (
        dimensions: RodProps['dimensions'],
        label = '4',
    ) => mount(CuisenaireRod, {
        props: { ...props, dimensions, label, presentation: 'flat-units' },
    })

    it('divides a horizontal piece into one flat cell per unit', () => {
        const wrapper = units({ width: 4, depth: 1, height: 1 })
        const rod = wrapper.get('.rod')
        const style = rod.attributes('style') ?? ''

        expect(rod.attributes('data-rod-presentation')).toBe('flat-units')

        // Flat: no extruded faces and no height to lift the surface.
        expect(wrapper.findAll('.face')).toHaveLength(0)
        expect(style).toContain('--h: 0px')

        // The 4×1 footprint is unchanged; the divisions follow it.
        expect(style).toContain('--w: 72px')
        expect(style).toContain('--d: 18px')
        expect(style).toContain('--unit-columns: 4')
        expect(style).toContain('--unit-rows: 1')

        // Four drawn cells and no printed numbers anywhere on the group.
        expect(wrapper.findAll('.unit')).toHaveLength(4)
        expect(wrapper.text()).toBe('')

        // One group, one hit target: the cells never become separate pieces.
        expect(wrapper.findAll('[data-rod-surface]')).toHaveLength(1)
    })

    it('divides a vertical piece down its 1-by-value footprint', () => {
        const wrapper = units({ width: 1, depth: 4, height: 1 })
        const style = wrapper.get('.rod').attributes('style') ?? ''

        expect(style).toContain('--unit-columns: 1')
        expect(style).toContain('--unit-rows: 4')
        expect(wrapper.findAll('.unit')).toHaveLength(4)
    })

    it.each([
        [1, { width: 1, depth: 1, height: 1 }],
        [5, { width: 5, depth: 1, height: 1 }],
        [10, { width: 1, depth: 10, height: 1 }],
    ])('shows %i unit cells, so the division is not value or colour specific', (
        value,
        dimensions,
    ) => {
        const wrapper = units(dimensions, String(value))

        expect(wrapper.findAll('.unit')).toHaveLength(value)
        expect(wrapper.text()).toBe('')
    })

    it('keeps the group total addressable without printing it over the cells', () => {
        const wrapper = units({ width: 4, depth: 1, height: 1 })

        // The total is retained as an annotation; the surface stays unlabelled
        // so nothing is centred across the divided cells.
        expect(wrapper.get('.rod').attributes('data-rod-label')).toBe('4')
        expect(wrapper.get('[data-rod-surface]').text()).toBe('')
    })

    it('hides the division from assistive technology and from the pointer', () => {
        const wrapper = units({ width: 4, depth: 1, height: 1 })

        expect(wrapper.get('.units').attributes('aria-hidden')).toBe('true')
    })
})
