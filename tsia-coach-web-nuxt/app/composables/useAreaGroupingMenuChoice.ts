import { computed } from 'vue'
import type { useRodScene } from './useRodScene'
import type { SceneMenuChoice } from '~/components/rod/scene/scene-menu.types'
import type { AreaGroupReading } from '~/components/tabla/area-grouping'

const defaultLabel = 'Regroup selected area'

/**
 * A submenu of its own, independent of the factor menus. regroup-factors can
 * change a quantity's footprint; this only repartitions the cells it already
 * covers, so the two must not share a picker.
 */
export function useAreaGroupingMenuChoice(
  scene: ReturnType<typeof useRodScene>,
  label = defaultLabel,
  /** A board's note on a reading, such as "target y grouping". */
  note?: (reading: AreaGroupReading, active: boolean) => string | undefined,
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
    // Several rods are offered only where the board allows rectangles; the
    // scene returns no choices otherwise.
    const choices = scene.getAreaGroupingChoices(ids.length === 1 ? ids[0]! : ids)
    if (ids.length > 1 && !choices.length) {
      const fallback = scene.check(ids, { type: 'regroup-area', grouping: 'columns' })
      return {
        kind: 'submenu',
        label,
        children: [],
        disabledReason: fallback.allowed ? 'Select one filled rectangle to regroup its area.' : fallback.reason,
      }
    }
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
        label: note
          ? [`${reading.label} — ${reading.arrangement}`, note(reading, active)].filter(Boolean).join(' · ')
          : `${reading.label} (${reading.arrangement})`,
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
