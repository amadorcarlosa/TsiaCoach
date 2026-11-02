import {
  computed,
  nextTick,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  readonly,
  ref,
  shallowRef,
  watch,
  type Ref,
} from 'vue'
import type { RodTrain, SceneResult } from '~/components/rod/scene/rod.scene.types'
import type { RodPreview } from '~/components/rod/rod.types'
import { copyScene } from '~/components/rod/scene/scene-snapshot'
import {
  zeroPairBaseline,
  zeroPairReasons,
  type ZeroPairPlan,
} from '~/components/rod/scene/zero-pair-cancellation'
import { zeroPairOutcome } from '~/components/rod/scene/zero-pair-text'
import type { useRodScene } from './useRodScene'

type Session = {
  ids: readonly string[]
  /** Owned copies of both inputs as previewed; the commit is checked against them. */
  baseline: RodTrain[]
  key: string
  plan: ZeroPairPlan
}

/**
 * The transient zero-pair preview. It owns no scene data: opening, keeping
 * and dismissing never change trains, selection or IDs. Only confirm()
 * commits, through the scene's own revalidating action.
 */
export function useCancellationPreview(options: {
  scene: ReturnType<typeof useRodScene>
  viewport: Ref<HTMLElement | null>
  /** Editing availability apart from the preview itself (tab, portrait). */
  disabled: () => boolean
  /** Stop unfinished drags, inertia and marquee; close the invoking menu. */
  beforeOpen: () => void
}) {
  const { scene } = options
  const session = shallowRef<Session | null>(null)
  const announcement = ref('')
  const active = computed(() => session.value !== null)

  async function focusPiece(ids: readonly string[]): Promise<void> {
    await nextTick()
    const viewport = options.viewport.value
    const target = ids
      .map(id => viewport?.querySelector<HTMLElement>(`[data-piece-id="${CSS.escape(id)}"]`))
      .find(element => element) ?? viewport
    target?.focus({ preventScroll: true })
  }

  function open(ids: readonly string[]): SceneResult {
    if (options.disabled()) return { allowed: false, reason: 'Editing is unavailable.' }
    if (session.value) return { allowed: false, reason: 'A zero pair is already being previewed.' }

    options.beforeOpen()
    const planned = scene.planZeroPair(ids)
    if (!planned.allowed) {
      announcement.value = planned.reason
      return planned
    }

    const wanted = new Set(ids)
    session.value = {
      ids: [...ids],
      baseline: copyScene(scene.trains.value.filter(train => wanted.has(train.id))),
      key: zeroPairBaseline(scene.trains.value, ids),
      plan: planned.plan,
    }
    announcement.value = ''
    return { allowed: true }
  }

  /** Leave without committing. Focus returns to a source rod, else the board. */
  function dismiss(reason = '', restoreFocus = true): void {
    const current = session.value
    if (!current) return
    session.value = null
    announcement.value = reason
    if (restoreFocus) void focusPiece(current.ids)
  }

  function confirm(): SceneResult {
    const current = session.value
    if (!current) return { allowed: false, reason: 'Nothing is being previewed.' }

    const result = scene.apply(current.ids, {
      type: 'cancel-zero-pair',
      expectedInputs: current.baseline,
    })
    session.value = null

    if (!result.allowed) {
      announcement.value = result.reason
      void focusPiece(current.ids)
      return result
    }

    announcement.value = zeroPairOutcome(current.plan)
    // The survivor is selected by the scene; an equal pair leaves the board.
    void focusPiece(current.plan.survivorId ? [current.plan.survivorId] : [])
    return { allowed: true }
  }

  // Anything that changes the inputs makes the preview stale.
  watch(() => scene.trains.value, trains => {
    const current = session.value
    if (current && zeroPairBaseline(trains, current.ids) !== current.key) {
      dismiss(zeroPairReasons.stale)
    }
  })

  watch(() => scene.selection.value, selection => {
    const current = session.value
    if (current && (selection.size !== current.ids.length || current.ids.some(id => !selection.has(id)))) {
      dismiss()
    }
  })

  watch(options.disabled, disabled => {
    if (disabled) dismiss('', false)
  }, { flush: 'sync' })

  const onBlur = () => dismiss('', false)
  onMounted(() => window.addEventListener('blur', onBlur))
  onBeforeUnmount(() => {
    window.removeEventListener('blur', onBlur)
    dismiss('', false)
  })
  onDeactivated(() => dismiss('', false))

  /** Decorative instructions for the renderer; never scene data. */
  const previews = computed(() => {
    const map = new Map<string, RodPreview>()
    const plan = session.value?.plan
    if (!plan) return map
    for (const id of [plan.positive.id, plan.negative.id]) {
      map.set(id, plan.decomposition?.trainId === id
        ? { role: 'decomposed', pieces: plan.decomposition.pieces }
        : { role: 'zero-pair' })
    }
    return map
  })

  return {
    active,
    plan: computed(() => session.value?.plan ?? null),
    previews,
    announcement: readonly(announcement),
    open,
    confirm,
    dismiss,
  }
}
