import { computed } from 'vue'
import type { useRodScene } from './useRodScene'
import type { SceneMenuChoice } from '~/components/rod/scene/scene-menu.types'

/** Opens the zero-pair preview; it never commits a cancellation itself. */
export function useZeroPairMenuChoice(scene: ReturnType<typeof useRodScene>) {
  return computed<SceneMenuChoice>(() => {
    const planned = scene.planZeroPair([...scene.selection.value])
    return {
      kind: 'command',
      label: planned.allowed && planned.plan.decomposition ? 'Find a zero pair' : 'Cancel zero pair',
      command: 'preview-zero-pair',
      result: planned.allowed ? { allowed: true } : planned,
    }
  })
}
