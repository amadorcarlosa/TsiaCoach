import { computed } from 'vue'
import type { useRodScene } from './useRodScene'
import type { SceneMenuChoice } from '~/components/rod/scene/scene-menu.types'

export function useFactorMenuChoice(
  scene: ReturnType<typeof useRodScene>,
) {
  return computed<SceneMenuChoice>(() => {
    const ids = [...scene.selection.value]

    if (ids.length > 1) {
      return {
        kind: 'action',
        label: 'Regroup each to factors (closest to square)',
        action: { type: 'regroup-factors' },
      }
    }

    if (!ids.length) {
      return {
        kind: 'submenu',
        label: 'Regroup to factors',
        children: [],
        disabledReason: 'Select an object first.',
      }
    }

    const choices = scene.getFactorChoices(ids[0]!)
    const anyAllowed = choices.some(choice => choice.result.allowed)

    const defaultResult = scene.check(ids, {
      type: 'regroup-factors',
    })

    return {
      kind: 'submenu',
      label: 'Regroup to factors',
      children: choices.map(({ shape }) => ({
        kind: 'action',
        label: `${shape.rows} rows of ${shape.columns}`,
        action: {
          type: 'regroup-factors',
          shape,
        },
      })),
      disabledReason: anyAllowed
        ? undefined
        : defaultResult.allowed
          ? 'No factor arrangement fits here.'
          : defaultResult.reason,
    }
  })
}
