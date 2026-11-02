// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DraggableRod from './DraggableRod.vue'
import type { DragProps } from '~/components/rod/rod.types'
import type { TrainPart } from '~/components/rod/scene/rod.scene.types'

// Presentation is markup, not motion: the drag runtime is stubbed so these
// checks stay in the component rather than in gsap.
vi.stubGlobal('useNuxtApp', () => ({
  $gsap: { set: () => undefined, killTweensOf: () => undefined },
  $Draggable: { create: () => [] },
}))

const props: DragProps = {
  id: 'piece-1',
  value: 4,
  x: 2,
  y: 2,
  cellSize: 20,
}

const train: TrainPart[] = [
  { value: 4, orientation: 'horizontal', offset: { x: 0, y: 0 } },
  { value: 2, orientation: 'horizontal', offset: { x: 0, y: 1 } },
]

const rod = (overrides: Partial<DragProps> = {}) =>
  mount(DraggableRod, { props: { ...props, ...overrides } })

describe('DraggableRod presentation', () => {
  it('stays raised when a board asks for nothing', () => {
    const wrapper = rod()

    expect(wrapper.get('[data-piece-id]').attributes('data-presentation')).toBe('raised')
    expect(wrapper.findAll('.face')).toHaveLength(6)
    expect(wrapper.findAll('.unit')).toHaveLength(0)
  })

  it('divides a flat-units piece into unit cells inside its unchanged footprint', () => {
    const wrapper = rod({ presentation: 'flat-units' })
    const piece = wrapper.get('[data-piece-id]')

    expect(piece.attributes('data-presentation')).toBe('flat-units')
    expect(wrapper.findAll('.face')).toHaveLength(0)
    expect(wrapper.findAll('.unit')).toHaveLength(4)

    // The 4×1 board footprint is the same one a raised four occupies.
    const style = piece.attributes('style') ?? ''
    expect(style).toContain('width: 80px')
    expect(style).toContain('height: 20px')
  })

  it('divides each part of a train separately and keeps one perimeter per part', () => {
    const wrapper = rod({ parts: train, presentation: 'flat-units' })
    const parts = wrapper.findAll('.train-part')

    expect(parts).toHaveLength(2)
    expect(parts.map(part => part.findAll('.unit').length)).toEqual([4, 2])

    // One group perimeter and one hit target per part, not per unit.
    expect(wrapper.findAll('.rod--units')).toHaveLength(2)
    expect(wrapper.findAll('[data-rod-surface]')).toHaveLength(2)
  })

  it('describes a divided group once, leaving its cells out of the a11y tree', () => {
    const single = rod({ presentation: 'flat-units' })
    const compound = rod({ parts: train, presentation: 'flat-units' })

    expect(single.get('[data-piece-id]').attributes('aria-label'))
      .toContain('Group of 4 unit squares')
    expect(compound.get('[data-piece-id]').attributes('aria-label'))
      .toContain('Train, value 6, 2 groups of unit squares')

    // Every part wrapper is hidden, so no cell is announced as its own piece.
    for (const part of compound.findAll('.train-part')) {
      expect(part.attributes('aria-hidden')).toBe('true')
    }
  })

  it('keeps identity and selection on the train, not on the divisions', () => {
    const wrapper = rod({ presentation: 'flat-units', selected: true })
    const piece = wrapper.get('[data-piece-id]')

    expect(piece.attributes('data-piece-id')).toBe('piece-1')
    expect(piece.classes()).toContain('draggable-rod--selected')
    expect(piece.attributes('tabindex')).toBe('0')
  })
})


describe('addend group presentation', () => {
  it('outlines two 12s and names the addends for assistive technology', () => {
    const wrapper = rod({ parts: [
      { value: 10, addendGroup: 0, orientation: 'horizontal', offset: { x: 0, y: 0 } },
      { value: 2, addendGroup: 0, orientation: 'horizontal', offset: { x: 10, y: 0 } },
      { value: 10, addendGroup: 1, orientation: 'horizontal', offset: { x: 12, y: 0 } },
      { value: 2, addendGroup: 1, orientation: 'horizontal', offset: { x: 22, y: 0 } },
    ] })
    expect(wrapper.findAll('[data-addend-value="12"]')).toHaveLength(2)
    expect(wrapper.get('[data-piece-id]').attributes('aria-label')).toContain('addends 12 + 12')
    expect(wrapper.get('[data-addend-group="1"]').attributes('style')).toContain('left: 242px')
  })
})


describe('selection on rod surfaces', () => {
  it.each(['raised', 'flat', 'flat-units'] as const)('highlights every part of a selected %s train and clears on deselection', async presentation => {
    const wrapper = rod({ parts: train, presentation, selected: true })
    expect(wrapper.findAll('.rod--selected [data-rod-surface]')).toHaveLength(2)
    expect(wrapper.get('[data-piece-id]').attributes('aria-label')).toContain('Selected.')
    await wrapper.setProps({ selected: false })
    expect(wrapper.findAll('.rod--selected')).toHaveLength(0)
  })
  it('highlights the cap of a tower using the same renderer', () => {
    const wrapper = rod({ selected: true, dimensions: { width: 1, depth: 1, height: 4 } })
    expect(wrapper.findAll('.rod--selected .top')).toHaveLength(1)
  })
})

describe('DraggableRod negative rods', () => {
  const negative = (value: TrainPart['value'], x: number): TrainPart =>
    ({ value, sign: -1, orientation: 'horizontal', offset: { x, y: 0 } })

  it('keeps the colour and footprint, recesses the cap and labels the sign', () => {
    const plain = rod({ value: 10, parts: [{ value: 10, orientation: 'horizontal', offset: { x: 0, y: 0 } }] })
    const signed = rod({ value: 10, parts: [negative(10, 0)] })

    const style = (wrapper: typeof plain) => wrapper.get('.rod').attributes('style') ?? ''
    expect(style(signed)).toBe(style(plain))
    expect(signed.get('.rod').classes()).toContain('rod--negative')
    expect(signed.get('.rod').attributes('data-rod-sign')).toBe('negative')
    expect(signed.get('[data-rod-surface]').text()).toBe('−10')
    // Still one surface and the same six faces: nothing extra can take input.
    expect(signed.findAll('[data-rod-surface]')).toHaveLength(1)
    expect(signed.findAll('.face')).toHaveLength(6)
    expect(signed.get('[data-piece-id]').attributes('aria-label'))
      .toBe('Negative 10 rod at column 2, row 2. Use arrow keys to move.')
  })

  it('names signed and mixed trains by signed total and physical length', () => {
    const homogeneous = rod({ parts: [negative(10, 0), negative(4, 10)] })
    const mixed = rod({ parts: [{ value: 10, orientation: 'horizontal', offset: { x: 0, y: 0 } }, negative(4, 10)] })
    const zero = rod({ parts: [{ value: 10, orientation: 'horizontal', offset: { x: 0, y: 0 } }, negative(10, 10)] })

    expect(homogeneous.get('[data-piece-id]').attributes('aria-label'))
      .toContain('Train, signed total -14, physical length 14, 2 parts')
    expect(mixed.get('[data-piece-id]').attributes('aria-label'))
      .toContain('Mixed-sign train, signed total 6, physical length 14, 2 parts')
    // Zero total is still material on the board, not an empty object.
    expect(zero.get('[data-piece-id]').attributes('aria-label'))
      .toContain('Mixed-sign train, signed total 0, physical length 20, 2 parts')
  })

  it('keeps the selection ring on the recessed cap', () => {
    const wrapper = rod({ parts: [negative(3, 0)], selected: true })
    expect(wrapper.get('.rod').classes()).toEqual(expect.arrayContaining(['rod--negative', 'rod--selected']))
  })
})


describe('opt-in zero-plane rendering', () => {
  it('uses the shared sign and selection data without altering the semantic train', () => {
    const wrapper = rod({ selected: true, zeroPlane: { depth: 36, tilt: 28, transparent: true }, parts: [
      { value: 10, sign: -1, orientation: 'horizontal', offset: { x: 0, y: 0 } },
      { value: 4, sign: -1, orientation: 'horizontal', offset: { x: 10, y: 0 } },
    ] })
    expect(wrapper.findAll('[data-zero-sign="-1"]')).toHaveLength(2)
    expect(wrapper.findAll('.zero-rod.selected')).toHaveLength(2)
    expect(wrapper.findAll('[data-piece-id]')).toHaveLength(1)
    expect(wrapper.get('[data-piece-id]').attributes('aria-label')).toContain('-14')
  })
})
