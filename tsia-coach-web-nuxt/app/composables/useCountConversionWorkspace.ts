import { computed, shallowRef, watch, type DeepReadonly, type Ref } from 'vue'
import type { RodTrain, SceneAction, SceneApplyResult, ScenePolicy } from '~/components/rod/scene/rod.scene.types'
import { copyScene } from '~/components/rod/scene/scene-snapshot'
import type { CandidateCounts, ExchangeStep } from '~/components/systems/systems.candidates'
import { assessConversion, targetShape, type ConversionAssessment } from '~/components/systems/systems.count-conversion'
import { countLayout } from '~/components/systems/systems.count-layout'
import { conversionSource, encodePlacements, planCountTransform } from '~/components/systems/systems.count-operations'
import type { SystemsBoardConfig } from '~/components/systems/systems.schema'
import { describeRodAction, recordSceneActions, rodSceneSummary, silentSceneEvents, type SceneEvents } from '~/components/playground/events/scene-events'
import { useRodScene } from './useRodScene'

/**
 * The editable conversion workspace. The committed scene stays authoritative:
 * the learner edits a draft copy in a second scene that shares the placement
 * engine, with every rod outside the conversion protected. Apply replans one
 * board transform against the committed scene; Cancel discards the draft.
 */

type Snapshot = readonly DeepReadonly<RodTrain>[]

export type CountConversionSession = {
  /** Problem and committed scene when the conversion opened; any change is stale. */
  baselineKey: string
  baseline: readonly RodTrain[]
  sourceIds: readonly string[]
  protectedIds: ReadonlySet<string>
  baselineCounts: CandidateCounts
  next: CandidateCounts
  step: ExchangeStep
}

const none: ReadonlySet<string> = new Set()

/** Problem identity plus the committed scene, order-independent. Never selection or camera. */
export function conversionKey(config: SystemsBoardConfig, trains: Snapshot): string {
  const sorted = [...trains].sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0))
  return JSON.stringify([config, copyScene(sorted)])
}

export function useCountConversionWorkspace(options: {
  config: Readonly<Ref<SystemsBoardConfig>>
  scene: ReturnType<typeof useRodScene>
  /** The committed board can be edited (active tab, not portrait preview). */
  editable: () => boolean
  /** Learner action log of the committed board; draft edits are recorded into it too. */
  events?: SceneEvents
}) {
  const { config, scene } = options
  const events = options.events ?? silentSceneEvents
  const layout = computed(() => countLayout(config.value))
  const session = shallowRef<CountConversionSession | null>(null)
  const message = shallowRef('')

  // Same grid, regions and placement rules as the committed board, plus the
  // area tools. Protection applies only once a session has hydrated it.
  const draftPolicy: ScenePolicy = {
    get columns() { return layout.value.columns },
    get rows() { return layout.value.rows },
    get spawnRows() { return [layout.value.upper.y] },
    get regions() { return layout.value.regions },
    editable: () => session.value !== null && options.editable(),
    allowOrientation: true,
    allowFactors: true,
    allowAreaRegroup: true,
    allowRectangles: true,
    regionBoundEdits: true,
    protectedIds: () => session.value?.protectedIds ?? none,
  }
  // Draft edits are how the learner regroups the area, so they are logged like
  // board edits, summarised by the editable material only.
  const draftScene = useRodScene(draftPolicy)
  const draft = recordSceneActions(
    draftScene,
    { playground: 'rod-count-systems', record: entry => events.record(entry) },
    ({ selected }, action: SceneAction, result) => describeRodAction(selected as Snapshot, action, result, material.value),
    () => rodSceneSummary(material.value),
  )

  const active = computed(() => session.value !== null)
  const protectedIds = computed(() => session.value?.protectedIds ?? none)

  /** Editable draft material: everything except the protected context. */
  const material = computed<Snapshot>(() => {
    const locked = protectedIds.value
    return session.value ? draftScene.trains.value.filter(train => !locked.has(train.id)) : []
  })

  const assessment = computed<ConversionAssessment | null>(() => {
    const current = session.value
    if (!current) return null
    return assessConversion(current.step, config.value.system.equations[0].coefficients, material.value)
  })

  /** The rectangle whose columns become the new y rods, for menu suggestions. */
  const suggestedShape = computed(() => {
    const current = session.value
    return current ? targetShape(current.step, config.value.system.equations[0].coefficients.y) : null
  })

  const availability = computed(() => {
    const source = conversionSource(config.value, scene.trains.value, [...scene.selection.value])
    return source.allowed ? { allowed: true as const } : { allowed: false as const, reason: source.reason }
  })

  function begin(ids: readonly string[]): SceneApplyResult {
    const opened = open(ids)
    events.record({
      type: 'conversion.started',
      ...(opened.allowed ? { outcome: 'applied' as const } : { outcome: 'rejected' as const, reason: opened.reason.slice(0, 200) }),
      data: { pieceIds: ids.slice(0, 100), count: ids.length },
    })
    return opened
  }

  function open(ids: readonly string[]): SceneApplyResult {
    if (session.value) return { allowed: false, reason: 'A conversion is already open.' }
    if (!options.editable()) return { allowed: false, reason: 'Editing is unavailable.' }
    const source = conversionSource(config.value, scene.trains.value, ids)
    if (!source.allowed) {
      message.value = source.reason
      return source
    }
    const baseline = copyScene(scene.trains.value)
    session.value = {
      baselineKey: conversionKey(config.value, scene.trains.value),
      baseline,
      sourceIds: source.sourceIds,
      protectedIds: new Set(baseline.map(train => train.id).filter(id => !source.sourceIds.includes(id))),
      baselineCounts: source.counts,
      next: source.next,
      step: source.step,
    }
    // Hydration is not an edit, so protection does not apply to it.
    const hydrated = draft.replace(baseline)
    if (!hydrated.allowed) {
      session.value = null
      message.value = hydrated.reason
      return hydrated
    }
    draft.select(source.sourceIds)
    message.value = ''
    return { allowed: true, createdIds: [] }
  }

  /** Discards every draft experiment; the committed scene was never touched. */
  function cancel(reason = '', by: 'learner' | 'system' = 'system'): boolean {
    const current = session.value
    if (!current) return false
    session.value = null
    message.value = reason
    scene.select(current.sourceIds)
    // `variant` says who cancelled: the learner, or the board on their behalf.
    events.record({
      type: 'conversion.cancelled',
      outcome: 'applied',
      data: { pieceIds: current.sourceIds.slice(0, 100), variant: by },
    })
    return true
  }

  function apply(): SceneApplyResult {
    const current = session.value
    if (!current) return { allowed: false, reason: 'No conversion is open.' }
    const fail = (reason: string): SceneApplyResult => {
      message.value = reason
      events.record({ type: 'denomination.converted', outcome: 'rejected', reason: reason.slice(0, 200), data: { pieceIds: current.sourceIds.slice(0, 100) } })
      return { allowed: false, reason }
    }
    if (conversionKey(config.value, scene.trains.value) !== current.baselineKey) {
      cancel('The board changed, so the conversion was cancelled.')
      return { allowed: false, reason: message.value }
    }
    const source = conversionSource(config.value, scene.trains.value, current.sourceIds)
    if (!source.allowed) return fail(source.reason)

    // The scene enforces protection on every action; check it again here.
    const before = new Map(current.baseline.map(train => [train.id, JSON.stringify(copyScene([train]))]))
    const intact = [...current.protectedIds].every(id => {
      const train = draft.trains.value.find(item => item.id === id)
      return train !== undefined && JSON.stringify(copyScene([train])) === before.get(id)
    })
    if (!intact) return fail('Rods outside the conversion changed. Cancel and start again.')

    const state = assessment.value
    if (!state?.ready) return fail(state?.reason ?? 'The conversion is not ready.')

    // Only validated integer placements cross into the committed scene; the
    // planner rebuilds the y rods from them and the scene revalidates.
    const params = encodePlacements(state.placements)
    const planned = planCountTransform(config.value, scene.trains.value, current.sourceIds, { name: 'count-exchange', params })
    if (!planned.allowed) return fail(planned.reason)
    const result = scene.apply(current.sourceIds, {
      type: 'board-transform',
      transform: { name: 'count-exchange', params, expected: planned.plan.key },
    })
    if (!result.allowed) return fail(result.reason)
    session.value = null
    message.value = `Converted ${current.step.removedX} x rods into ${current.step.addedY} y rods: x = ${current.next.xCount}, y = ${current.next.yCount}.`
    return result
  }

  // Any outside change to the problem or committed scene makes the session stale.
  watch(() => session.value ? conversionKey(config.value, scene.trains.value) : null, key => {
    if (session.value && key !== null && key !== session.value.baselineKey) cancel('The board changed, so the conversion was cancelled.')
  })

  return {
    session,
    active,
    draft,
    protectedIds,
    material,
    assessment,
    suggestedShape,
    availability,
    message,
    begin,
    cancel,
    apply,
  }
}
