import type { SceneMenuChoice } from './scene-menu.types'
import type { TrainPart } from './rod.scene.types'

/**
 * The context-menu actions every rod playground offers, in their shared order.
 * Boards add their own choices (factors, area grouping, orientation, roles)
 * between these and Delete, which always comes last.
 */
export function baseRodMenuChoices(addendChoice: SceneMenuChoice): SceneMenuChoice[] {
  return [
    { kind: 'action', label: 'Clone', action: { type: 'clone' } },
    { kind: 'action', label: 'Make a train', action: { type: 'make-train' } },
    { kind: 'action', label: 'Undo train', action: { type: 'ungroup' } },
    { kind: 'action', label: 'Regroup to ones', action: { type: 'regroup-ones' } },
    addendChoice,
  ]
}

export const deleteMenuChoice: SceneMenuChoice = {
  kind: 'action',
  label: 'Delete',
  action: { type: 'delete' },
}

/** One checkable item per orientation; the selected rod's current one is checked. */
export function orientationMenuChoices(
  orientations: readonly TrainPart['orientation'][],
  selected: TrainPart['orientation'] | undefined,
): SceneMenuChoice[] {
  return orientations.map(orientation => ({
    kind: 'action',
    label: orientation[0]!.toUpperCase() + orientation.slice(1),
    action: { type: 'set-orientation', orientation },
    checked: selected === orientation,
  }))
}
