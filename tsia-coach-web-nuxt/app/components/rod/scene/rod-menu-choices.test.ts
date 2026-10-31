import { describe, expect, it } from 'vitest'
import { baseRodMenuChoices, deleteMenuChoice, orientationMenuChoices } from './rod-menu-choices'
import { regionAt } from './scene-regions'
import type { SceneMenuChoice } from './scene-menu.types'

const addend: SceneMenuChoice = { kind: 'submenu', label: 'Regroup to addends', children: [] }

describe('rod menu choices', () => {
  it('lists the shared actions in order, ending with the addend submenu', () => {
    expect(baseRodMenuChoices(addend).map(choice => choice.label))
      .toEqual(['Clone', 'Make a train', 'Undo train', 'Regroup to ones', 'Regroup to addends'])
    expect(deleteMenuChoice).toMatchObject({ label: 'Delete', action: { type: 'delete' } })
  })

  it('checks only the selected rod’s orientation', () => {
    const choices = orientationMenuChoices(['horizontal', 'vertical', 'tower'], 'vertical')

    expect(choices.map(choice => [choice.label, choice.kind === 'action' && choice.checked]))
      .toEqual([['Horizontal', false], ['Vertical', true], ['Tower', false]])
    // Nothing selected: every item is still checkable, none checked.
    expect(orientationMenuChoices(['horizontal'], undefined)[0]).toMatchObject({ checked: false })
  })
})

describe('regionAt', () => {
  const regions = [
    { id: 'track', x: 2, y: 0, width: 4, depth: 1, orientations: ['horizontal'] },
    { id: 'array', x: 2, y: 2, width: 4, depth: 3, orientations: ['horizontal', 'vertical'] },
  ] as const

  it('finds the region containing a point, with exclusive far edges', () => {
    expect(regionAt(regions, { x: 2, y: 0 })?.id).toBe('track')
    expect(regionAt(regions, { x: 5.9, y: 4.9 })?.id).toBe('array')
    expect(regionAt(regions, { x: 6, y: 2 })).toBeUndefined()
  })

  it('returns nothing on the gaps between regions', () => {
    expect(regionAt(regions, { x: 3, y: 1.5 })).toBeUndefined()
    expect(regionAt(regions, { x: 0, y: 0 })).toBeUndefined()
  })
})
