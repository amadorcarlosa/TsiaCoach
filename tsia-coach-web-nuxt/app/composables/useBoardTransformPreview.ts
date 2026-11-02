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
import type { RodPreview } from '~/components/rod/rod.types'
import type { BoardTransform, RodTrain, SceneResult } from '~/components/rod/scene/rod.scene.types'
import type { useRodScene } from './useRodScene'

/** What a board planner reports for a preview: the change plus its wording. */
export type BoardTransformPreviewPlan = {
  remove: readonly string[]
  add: readonly RodTrain[]
  title: string
  lines: readonly string[]
  key: string
}

type PlanResult =
  | { allowed: true; plan: BoardTransformPreviewPlan }
  | { allowed: false; reason: string }

type Session = {
  ids: readonly string[]
  transform: BoardTransform
  plan: BoardTransformPreviewPlan
}

/**
 * The transient preview for a board command. Opening, keeping and dismissing
 * never change the scene; confirm() commits through the scene's own
 * 'board-transform' action, which replans against current data and refuses
 * a changed input.
 */
export function useBoardTransformPreview(options: {
  scene: ReturnType<typeof useRodScene>
  viewport: Ref<HTMLElement | null>
  disabled: () => boolean
  beforeOpen: () => void
  plan: (ids: readonly string[], transform: BoardTransform) => PlanResult
  staleReason: string
}) {
  const { scene } = options
  const session = shallowRef<Session | null>(null)
  const announcement = ref('')
  const active = computed(() => session.value !== null)

  async function focusFirst(ids: readonly string[]): Promise<void> {
    await nextTick()
    const viewport = options.viewport.value
    const target = ids
      .map(id => viewport?.querySelector<HTMLElement>(`[data-piece-id="${CSS.escape(id)}"]`))
      .find(element => element) ?? viewport
    target?.focus({ preventScroll: true })
  }

  /** The action that commits a session, carrying its input key. */
  const commitAction = (current: Session) => ({
    type: 'board-transform' as const,
    transform: { ...current.transform, expected: current.plan.key },
  })

  function open(ids: readonly string[], transform: BoardTransform): SceneResult {
    if (options.disabled()) return { allowed: false, reason: 'Editing is unavailable.' }
    if (session.value) return { allowed: false, reason: 'A change is already being previewed.' }

    options.beforeOpen()
    const planned = options.plan(ids, transform)
    if (!planned.allowed) {
      announcement.value = planned.reason
      return planned
    }
    const next = { ids: [...ids], transform, plan: planned.plan }
    // The full scene must accept the result (bounds, overlaps, regions).
    const check = scene.check(next.ids, commitAction(next))
    if (!check.allowed) {
      announcement.value = check.reason
      return check
    }
    session.value = next
    announcement.value = ''
    return { allowed: true }
  }

  function dismiss(reason = '', restoreFocus = true): void {
    const current = session.value
    if (!current) return
    session.value = null
    announcement.value = reason
    if (restoreFocus) void focusFirst(current.ids)
  }

  function confirm(): SceneResult {
    const current = session.value
    if (!current) return { allowed: false, reason: 'Nothing is being previewed.' }
    const result = scene.apply(current.ids, commitAction(current))
    session.value = null
    if (!result.allowed) {
      announcement.value = result.reason
      void focusFirst(current.ids)
      return result
    }
    announcement.value = `${current.plan.title}: done.`
    void focusFirst(result.createdIds)
    return { allowed: true }
  }

  // Any change to the inputs makes the preview stale.
  watch(() => scene.trains.value, () => {
    const current = session.value
    if (!current) return
    const replanned = options.plan(current.ids, current.transform)
    if (!replanned.allowed || replanned.plan.key !== current.plan.key) dismiss(options.staleReason)
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

  /** Decorative: pieces the change would remove. Never scene data. */
  const previews = computed(() => new Map<string, RodPreview>(
    (session.value?.plan.remove ?? []).map(id => [id, { role: 'removed' }]),
  ))

  /** Decorative outlines of the rows the change would add. */
  const ghosts = computed(() => session.value?.plan.add ?? [])

  return {
    active,
    session: computed(() => session.value),
    previews,
    ghosts,
    announcement: readonly(announcement),
    open,
    confirm,
    dismiss,
  }
}
