import { computed } from 'vue'
import type { useRodScene } from './useRodScene'
import type { SceneMenuChoice } from '~/components/rod/scene/scene-menu.types'

const label = 'Regroup selected area'

/**
 * A submenu of its own, independent of the factor menus. regroup-factors can
 * change a quantity's footprint; this only repartitions the cells it already
 * covers, so the two must not share a picker.
 */
export function useAreaGroupingMenuChoice(
  scene: ReturnType<typeof useRodScene>,
) {
  return computed<SceneMenuChoice>(() => {
    const ids = [...scene.selection.value]

    if (!ids.length) {
      return {
        kind: 'submenu',
        label,
        children: [],
        disabledReason: 'Select one filled rectangle first.',
      }
    }

    // Start with a single rectangle: combining loose rods is a separate,
    // explicit action, not something a grouping choice should do implicitly.
    if (ids.length > 1) {
      return {
        kind: 'submenu',
        label,
        children: [],
        disabledReason: 'Select one filled rectangle to regroup its area.',
      }
    }

    const choices = scene.getAreaGroupingChoices(ids[0]!)
    const fallback = scene.check(ids, { type: 'regroup-area', grouping: 'columns' })

    if (!choices.length) {
      return {
        kind: 'submenu',
        label,
        children: [],
        disabledReason: fallback.allowed
          ? 'Select one object that completely fills a rectangle.'
          : fallback.reason,
      }
    }

    const blocked = choices.find(choice => !choice.result.allowed)

    return {
      kind: 'submenu',
      label,
      children: choices.map(({ reading, active }) => ({
        kind: 'action',
        label: `${reading.label} (${reading.arrangement})`,
        action: { type: 'regroup-area', grouping: reading.grouping },
        checked: active,
      })),
      disabledReason: choices.some(choice => choice.result.allowed)
        ? undefined
        : blocked && !blocked.result.allowed
          ? blocked.result.reason
          : 'No grouping fits here.',
    }
  })
}
