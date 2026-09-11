import {
  computed,
  provide,
  readonly,
  ref,
  watch,
  type Ref,
} from 'vue'
import type { Point } from '~/components/grid/gridPointer'
import type { SceneAction } from '~/components/rod/scene/rod.scene.types'
import { sceneCancellationKey } from '~/components/rod/scene/scene-cancellation'
import type { useRodScene } from './useRodScene'
import { useSceneMenu } from './useSceneMenu'
import { useSceneInteraction } from './useSceneInteraction'
import { useSceneMarquee } from './useSceneMarquee'
import { useAddendMenuChoice } from './useAddendMenuChoice'

type Options = {
  scene: ReturnType<typeof useRodScene>
  viewport: Ref<HTMLElement | null>
  disabled: () => boolean

  /** Reactive getter; incrementing its source cancels synchronously. */
  cancelVersion: () => number
  onBoardClick?: (point: Point) => void
}

export function useRodPlaygroundInteraction(options: Options) {
  const { scene } = options

  const menu = useSceneMenu({
    scene,
    viewport: options.viewport,
    disabled: options.disabled,
  })

  const baseBlocked = computed(
    () => options.disabled() || menu.request.value !== null,
  )

  const interaction = useSceneInteraction({
    scene,
    blocked: () => baseBlocked.value || marquee.active.value,
  })

  // Keep the same injection key, scoped to this playground.
  // A local counter allows marquee to request cancellation too.
  const cancellation = ref(0)

  function cancelMovement(): void {
    interaction.cancelMove()
    cancellation.value++
  }

  provide(sceneCancellationKey, readonly(cancellation))

  const marquee = useSceneMarquee({
    scene,
    viewport: options.viewport,
    disabled: () => baseBlocked.value,
    beforeStart: cancelMovement,
    onBoardClick: point => options.onBoardClick?.(point),
  })

  const blocked = computed(
    () => baseBlocked.value || marquee.active.value,
  )

  function cancelGestures(): void {
    marquee.cancel()
    cancelMovement()
  }

  watch(options.cancelVersion, cancelGestures, { flush: 'sync' })

  watch(baseBlocked, value => {
    if (value) cancelGestures()
  }, { flush: 'sync' })

  const highlightedIds = computed(
    () => marquee.previewIds.value ?? scene.selection.value,
  )

  const selectedIds = computed(() => [...scene.selection.value])

  function checkSelected(action: SceneAction) {
    return scene.check(selectedIds.value, action)
  }

  function applySelected(action: SceneAction) {
    if (marquee.active.value) {
      return {
        allowed: false as const,
        reason: 'Finish selecting first.',
      }
    }

    return scene.apply(selectedIds.value, action)
  }

  return {
    menu,
    interaction,
    marquee,
    blocked,
    highlightedIds,
    selectedIds,
    checkSelected,
    applySelected,
    addendMenuChoice: useAddendMenuChoice(scene),
  }
}
