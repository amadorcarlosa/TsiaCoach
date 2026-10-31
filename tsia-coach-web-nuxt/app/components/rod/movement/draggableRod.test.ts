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
