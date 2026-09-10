import { computed } from 'vue'
import type { useRodScene } from './useRodScene'
import type { SceneMenuChoice } from '~/components/rod/scene/scene-menu.types'

export function useAddendMenuChoice(
  scene: ReturnType<typeof useRodScene>,
) {
  return computed<SceneMenuChoice>(() => {
    const ids = [...scene.selection.value]

    if (ids.length > 1) {
      return {
        kind: 'action',
        label: 'Decompose each using its first available pair',
        action: { type: 'regroup-addends' },
      }
    }

    if (ids.length === 0) {
      return {
        kind: 'submenu',
        label: 'Regroup to addends',
        children: [],
        disabledReason: 'Select an object first.',
      }
    }

    const choices = scene.getAddendChoices(ids[0]!)
    const anyAllowed = choices.some(choice => choice.result.allowed)

    const availability = scene.check(ids, {
      type: 'regroup-addends',
    })

    return {
      kind: 'submenu',
      label: 'Regroup to addends',
      children: choices.map(({ pair }) => ({
        kind: 'action',
        label: `${pair[0]} + ${pair[1]}`,
        action: {
          type: 'regroup-addends',
          pair,
        },
      })),
      disabledReason: anyAllowed
        ? undefined
        : availability.allowed
          ? 'No supported addend pairs are available.'
          : availability.reason,
    }
  })
}
