import {
  computed,
  provide,
  watch,
  type Ref,
} from 'vue'
import type { SceneAction } from '~/components/rod/scene/rod.scene.types'
import { sceneCancellationKey } from '~/components/rod/scene/scene-cancellation'
import type { useRodScene } from './useRodScene'
import { useSceneMenu } from './useSceneMenu'
import { useSceneInteraction } from './useSceneInteraction'
import { useAddendMenuChoice } from './useAddendMenuChoice'

type Options = {
  scene: ReturnType<typeof useRodScene>
  viewport: Ref<HTMLElement | null>
  disabled: () => boolean

  /** Reactive getter; incrementing its source cancels synchronously. */
  cancelVersion: () => number
}

export function useRodPlaygroundInteraction(options: Options) {
  const { scene } = options

  const menu = useSceneMenu({
    scene,
    viewport: options.viewport,
    disabled: options.disabled,
  })

  const blocked = computed(
    () => options.disabled() || menu.request.value !== null,
  )

  const interaction = useSceneInteraction({
    scene,
    blocked: () => blocked.value,
  })

  const cancellation = computed(options.cancelVersion)

  // Invalidate the scene session before notifying descendant drag engines.
  watch(
    cancellation,
    () => interaction.cancelMove(),
    { flush: 'sync' },
  )

  // Keep the internal drag signal scoped to this playground.
  provide(sceneCancellationKey, cancellation)

  watch(
    blocked,
    value => {
      if (value) interaction.cancelMove()
    },
    { flush: 'sync' },
  )

  const selectedIds = computed(() => [...scene.selection.value])

  function checkSelected(action: SceneAction) {
    return scene.check(selectedIds.value, action)
  }

  function applySelected(action: SceneAction) {
    return scene.apply(selectedIds.value, action)
  }

  return {
    menu,
    interaction,
    blocked,
    selectedIds,
    checkSelected,
    applySelected,
    addendMenuChoice: useAddendMenuChoice(scene),
  }
}
