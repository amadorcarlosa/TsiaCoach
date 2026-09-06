// @vitest-environment happy-dom
// app/components/rod/tray/rodTray.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RodTray from './RodTray.vue'
import CuisenaireRod from '../CuisenaireRod.vue'
import { cusisenaireRodPalette } from '../rod.types'
import { ariaRod, ariaTray, type RodTrayProps } from './rodTray.types'

// One place to build props. Tests override only what they care about.
function makeProps(overrides: Partial<RodTrayProps> = {}): RodTrayProps {
    return {
        items: [
            { value: 1, number: '1' },
            { value: 5, number: '5' },
            { value: 10, number: '10' },
        ],
        unitSize: 16,
        ...overrides,
    } as RodTrayProps
}

// Stub the rod drawing. These tests are about the tray, not the rod.
const stubs = { CuisenaireRod: true }

describe('RodTray', () => {
    it('renders an empty tray when there are no items', () => {
        const wrapper = mount(RodTray, { props: makeProps({ items: [] }), global: { stubs } })

        expect(wrapper.get('aside').findAll('button')).toHaveLength(0)
    })

    it('passes the item dimensions, unit size, appearance, and label to the rod', () => {
        const wrapper = mount(RodTray, {
            props: makeProps({
                items: [{ value: 5, number: 'five', color: 'yellow' }],
                unitSize: 24,
            }),
        })

        expect(wrapper.getComponent(CuisenaireRod).props()).toEqual({
            dimensions: { width: 5, depth: 1, height: 1 },
            unitSize: 24,
            appearance: cusisenaireRodPalette[5],
            label: '5',
        })
    })

    it('renders one button per item inside a labeled tray', () => {
        const wrapper = mount(RodTray, { props: makeProps(), global: { stubs } })

        expect(wrapper.get('aside').attributes('aria-label')).toBe(ariaTray)
        expect(wrapper.findAll('button')).toHaveLength(3)
    })

    it('gives each button the accessible name for its rod', () => {
        const wrapper = mount(RodTray, { props: makeProps(), global: { stubs } })

        const names = wrapper.findAll('button').map(b => b.attributes('aria-label'))
        expect(names).toEqual([ariaRod('1'), ariaRod('5'), ariaRod('10')])
    })

    it('emits choose with the rod value when a button is clicked', async () => {
        const wrapper = mount(RodTray, { props: makeProps(), global: { stubs } })

        await wrapper.get(`button[aria-label="${ariaRod('5')}"]`).trigger('click')

        expect(wrapper.emitted('choose')).toEqual([[5]])
    })
})
