import { computed, ref, shallowRef, watch, type DeepReadonly, type Ref } from 'vue'
import type { RodPreview } from '~/components/rod/rod.types'
import type { RodTrain, SceneApplyResult } from '~/components/rod/scene/rod.scene.types'
import { candidateIndex, checkEquation, exchangeStep, type CandidateCounts, type EquationCheck } from '~/components/systems/systems.candidates'
import { evaluateCountSystem } from '~/components/systems/systems.count-evaluate'
import { countHint, countPhase, countStatus } from '~/components/systems/systems.count-feedback'
import { countLayout, derivedLowerTrains, unitTrain } from '~/components/systems/systems.count-layout'
import { exchangeSelection, planCountTransform, selectedUnitCount } from '~/components/systems/systems.count-operations'
import { strategyOf, type SystemsBoardConfig, type VariableId } from '~/components/systems/systems.schema'
import type { useBoardTransformPreview } from './useBoardTransformPreview'
import { useCountConversionWorkspace } from './useCountConversionWorkspace'
import type { useRodScene } from './useRodScene'
import { silentSceneEvents, type SceneEvents } from '~/components/playground/events/scene-events'

/**
 * What Equation 2 shows, and why. The check is always derived from counts;
 * this says which counts and how truthfully to label them.
 * - current:   the committed material's own whole-unit counts
 * - confirmed: a conversion is open; the candidate it started from
 * - proposed:  as confirmed, and the workspace is ready to apply
 * - previous:  free editing left unfinished material; the last feasible candidate
 * - waiting:   no counts to check yet
 */
export type LowerDisplayKind = 'current' | 'confirmed' | 'proposed' | 'previous' | 'waiting'

export type LowerDisplay = {
  kind: LowerDisplayKind
  counts: CandidateCounts | null
  check: EquationCheck | null
  /** A label for the band, empty for ordinary current counts. */
  label: string
  proposed: CandidateCounts | null
}

/**
 * The rod-count activity controller. It stores only what cannot be derived
 * (the hint level and a transient message); counts, candidate, phase, history,
 * the Equation 2 check and success all derive from the problem and the
 * committed scene, so a restored save regenerates the same state.
 */
export function useSystemsCountActivity(options: {
  config: Readonly<Ref<SystemsBoardConfig>>
  scene: ReturnType<typeof useRodScene>
  preview: ReturnType<typeof useBoardTransformPreview>
  blocked: () => boolean
  /** The committed board can be edited at all (active tab, not portrait). */
  editable: () => boolean
  /** Learner action log; folds multi-rod edits into one event. */
  events?: SceneEvents
}) {
  const { config, scene, preview } = options
  const events = options.events ?? silentSceneEvents
  const outcome = (done: boolean, fallback: string) => done
    ? { outcome: 'applied' as const }
    : { outcome: 'rejected' as const, reason: (message.value || fallback).slice(0, 200) }
  const active = computed(() => strategyOf(config.value) === 'rod-count')
  const conversion = useCountConversionWorkspace({ config, scene, editable: options.editable })
  const converting = computed(() => conversion.active.value)
  const layout = computed(() => countLayout(config.value))
  const coefficients = computed(() => config.value.system.equations[0].coefficients)
  const evaluation = computed(() => evaluateCountSystem(config.value, scene.trains.value))
  const selectedUnits = computed(() => active.value
    ? selectedUnitCount(config.value, scene.trains.value, scene.selection.value)
    : 0)
  const phase = computed(() => countPhase(evaluation.value, {
    previewing: preview.active.value,
    selectedUnits: selectedUnits.value,
    converting: converting.value,
  }))
  const status = computed(() => phase.value === 'converting'
    ? conversionStatus()
    : countStatus(config.value, evaluation.value, phase.value, selectedUnits.value))
  const step = computed(() => exchangeStep(coefficients.value.x, coefficients.value.y))
  const message = ref('')

  const hintLevel = ref(0)
  const hint = computed(() => hintLevel.value ? countHint(config.value, evaluation.value, hintLevel.value) : '')
  // A new candidate or problem starts the hints over.
  watch(() => [config.value, evaluation.value.valid && evaluation.value.candidate?.xCount], () => { hintLevel.value = 0 })
  function nextHint(): void {
    hintLevel.value = Math.min(3, hintLevel.value + 1)
  }

  const counts = computed<CandidateCounts>(() => conversion.session.value?.baselineCounts
    ?? (evaluation.value.valid ? evaluation.value.counts : { xCount: 0, yCount: 0 }))

  // The last feasible committed candidate, scoped to this problem. A transient
  // display aid, never saved: refreshed only from committed material.
  const previous = shallowRef<{ config: SystemsBoardConfig; counts: CandidateCounts } | null>(null)
  watch([config, evaluation], ([target, current]) => {
    if (previous.value && previous.value.config !== target) previous.value = null
    if (current.valid && current.candidate) previous.value = { config: target, counts: { ...current.candidate } }
  }, { immediate: true })
  /** Forget the previous candidate: reset, import, restore and problem changes. */
  function forgetPrevious(): void {
    previous.value = null
  }

  const describe = (target: CandidateCounts) => `x = ${target.xCount}, y = ${target.yCount}`
  const lowerOf = (target: CandidateCounts) => checkEquation(config.value.system.equations[1], target)

  const display = computed<LowerDisplay>(() => {
    const session = conversion.session.value
    if (session) {
      const ready = conversion.assessment.value?.ready === true
      return {
        kind: ready ? 'proposed' : 'confirmed',
        counts: session.baselineCounts,
        check: lowerOf(session.baselineCounts),
        label: `Confirmed candidate: ${describe(session.baselineCounts)}` + (ready ? ` · Proposed: ${describe(session.next)}` : ''),
        proposed: ready ? session.next : null,
      }
    }
    const current = evaluation.value
    if (current.valid && current.clean) {
      return { kind: 'current', counts: current.counts, check: current.lower, label: '', proposed: null }
    }
    if (current.valid && previous.value) {
      return {
        kind: 'previous',
        counts: previous.value.counts,
        check: lowerOf(previous.value.counts),
        label: `Previous candidate (${describe(previous.value.counts)}) — current material is unfinished`,
        proposed: null,
      }
    }
    return { kind: 'waiting', counts: null, check: null, label: '', proposed: null }
  })

  /** Equation 2 for the displayed counts. Decorative, never scene data or saved. */
  const derived = computed<RodTrain[]>(() => active.value && display.value.counts
    ? derivedLowerTrains(config.value, display.value.counts)
    : [])

  function conversionStatus(): string {
    const session = conversion.session.value
    const state = conversion.assessment.value
    if (!session || !state) return ''
    return `Converting ${state.required} cells from the confirmed candidate ${describe(session.baselineCounts)}. ${state.reason}`
  }

  /** Candidates reached so far: the sequence up to the current one. */
  const history = computed<readonly CandidateCounts[]>(() => {
    const current = evaluation.value
    if (!current.valid) return []
    const { analysis } = current
    const sequence = analysis.status === 'solvable' || analysis.status === 'no-common-solution' ? analysis.sequence : []
    const index = conversion.session.value ? candidateIndex(sequence, conversion.session.value.baselineCounts) : current.candidateIndex
    return index < 0 ? [] : sequence.slice(0, index + 1)
  })

  // ---- Initial scene ---------------------------------------------------------

  /** One rod of each type, as the activity begins (Artboard 1). */
  function initialScene(target: SystemsBoardConfig = config.value): RodTrain[] {
    const shape = countLayout(target)
    const { x: a, y: b } = target.system.equations[0].coefficients
    return [unitTrain(shape.upper.x, shape.upper.y, a, 'start-x'), unitTrain(shape.upper.x + 1, shape.upper.y, b, 'start-y')]
  }

  /** The board holds nothing but the starting rods, so nothing would be lost. */
  function pristine(): boolean {
    const trains = scene.trains.value
    if (!trains.length) return true
    if (!active.value) return false
    const start = initialScene()
    // Compare placement fields, not serialized objects: validation may reorder keys.
    const same = (train: DeepReadonly<RodTrain>, rod: RodTrain) =>
      train.anchor.x === rod.anchor.x && train.anchor.y === rod.anchor.y && train.parts.length === rod.parts.length &&
      train.parts.every((part, index) => {
        const other = rod.parts[index]!
        return part.value === other.value && part.orientation === other.orientation && (part.sign ?? 1) === 1 &&
          part.offset.x === other.offset.x && part.offset.y === other.offset.y
      })
    return trains.length === start.length && start.every(rod => trains.some(train => same(train, rod)))
  }

  // ---- Building ---------------------------------------------------------------

  const valueOf = (variable: VariableId) => coefficients.value[variable]

  /**
   * Keeps "x rods, then y rods": when every y rod stands to the right of every
   * x rod, slide the y rods over so new x rods join the x block. A plain move,
   * so the y rods keep their identity; skipped when there is no room.
   */
  function makeRoomForX(variable: VariableId, count: number): void {
    if (variable !== 'x' || !evaluation.value.valid) return
    const units = evaluation.value.material.units
    const xs = units.filter(unit => unit.variable === 'x').map(unit => unit.footprint.x)
    const ys = units.filter(unit => unit.variable === 'y')
    if (!ys.length) return
    const yTrainIds = [...new Set(ys.map(unit => unit.trainId))]
    const pureY = yTrainIds.every(id => units.filter(unit => unit.trainId === id).every(unit => unit.variable === 'y'))
    if (!pureY || (xs.length && Math.min(...ys.map(unit => unit.footprint.x)) < Math.max(...xs))) return
    scene.apply(yTrainIds, { type: 'move', delta: { x: count, y: 0 } })
  }

  function addRods(variable: VariableId, count: number): void {
    if (options.blocked() || converting.value) return
    const created = events.during(() => placeRods(variable, count), created => ({
      type: 'count.rod-added',
      ...outcome(created.length > 0, 'No room for the rod.'),
      data: { variant: variable, count: created.length, ...(created.length ? { createdIds: created.slice(0, 100) } : {}) },
    }))
    if (created.length) scene.select(created)
  }

  /** Adds rods in "x, then y" order without selecting them. Returns the new IDs. */
  function placeRods(variable: VariableId, count: number): string[] {
    makeRoomForX(variable, count)
    const created: string[] = []
    for (let index = 0; index < count; index++) {
      const result = scene.apply([], { type: 'create', value: valueOf(variable) as RodTrain['parts'][0]['value'], regionId: layout.value.upper.id })
      if (!result.allowed) {
        message.value = created.length ? `Added ${created.length}. ${result.reason}` : result.reason
        break
      }
      created.push(...result.createdIds)
    }
    if (created.length === count) message.value = `Added ${count} ${variable} rod${count === 1 ? '' : 's'} (${valueOf(variable)}-rod${count === 1 ? '' : 's'}).`
    return created
  }

  /**
   * Clone for single upright x and y rods: the copies are added like +x / +y,
   * so the board keeps "x, then y". Null when the selection holds anything
   * else, and the caller clones normally. Called from a closing menu, so it
   * does not wait on options.blocked(); the scene still checks editability.
   */
  function cloneInOrder(ids: readonly string[]): SceneApplyResult | null {
    if (converting.value || !ids.length || !evaluation.value.valid) return null
    const units = evaluation.value.material.units
    const variables: VariableId[] = []
    for (const id of ids) {
      const train = scene.trains.value.find(item => item.id === id)
      const unit = units.find(item => item.trainId === id)
      if (!train || train.parts.length !== 1 || !unit) return null
      variables.push(unit.variable)
    }
    const created = events.during(() => (['x', 'y'] as const).flatMap(variable => {
      const amount = variables.filter(item => item === variable).length
      return amount ? placeRods(variable, amount) : []
    }), created => ({
      type: 'piece.duplicated',
      ...outcome(created.length > 0, 'No room to clone the selection.'),
      data: { pieceIds: ids.slice(0, 100), pieceKinds: variables, ...(created.length ? { createdIds: created.slice(0, 100) } : {}) },
    }))
    if (!created.length) return { allowed: false, reason: message.value || 'No room to clone the selection.' }
    return { allowed: true, createdIds: created }
  }

  /** Removes the rightmost single x or y rod. */
  function removeRod(variable: VariableId): void {
    if (options.blocked() || converting.value || !evaluation.value.valid) return
    const units = evaluation.value.material.units
    const single = scene.trains.value
      .filter(train => train.parts.length === 1 && units.some(unit => unit.trainId === train.id && unit.variable === variable))
      .sort((p, q) => q.anchor.x - p.anchor.x)[0]
    if (!single) {
      message.value = `There is no separate ${variable} rod to remove.`
      events.record({ type: 'count.rod-removed', ...outcome(false, ''), data: { variant: variable, count: 0 } })
      return
    }
    const result = events.during(() => scene.apply([single.id], { type: 'delete' }), result => ({
      type: 'count.rod-removed',
      ...(result.allowed ? { outcome: 'applied' as const } : { outcome: 'rejected' as const, reason: result.reason.slice(0, 200) }),
      data: { variant: variable, count: result.allowed ? 1 : 0, pieceIds: [single.id] },
    }))
    message.value = result.allowed ? `Removed one ${variable} rod.` : result.reason
  }

  // ---- Exchange ---------------------------------------------------------------

  /** Selects the rightmost x rods that make exactly one exchange. */
  function selectForExchange(): boolean {
    if (options.blocked() || converting.value) return false
    const result = exchangeSelection(config.value, scene.trains.value)
    if ('reason' in result) {
      message.value = result.reason
      return false
    }
    scene.select(result.ids)
    message.value = `Selected ${step.value.removedX} x rods to exchange.`
    return true
  }

  // The workspace and preview guard editing themselves; options.blocked() is
  // also true while the context menu that opens these is still closing.
  /** Opens the editable conversion workspace on the selected x rods. */
  function beginConversion(): boolean {
    const opened = conversion.begin([...scene.selection.value])
    message.value = opened.allowed ? '' : opened.reason
    return opened.allowed
  }

  function applyConversion() {
    const result = conversion.apply()
    message.value = conversion.message.value
    return result
  }

  function cancelConversion(reason = 'Conversion cancelled. Nothing changed.'): boolean {
    const cancelled = conversion.cancel(reason)
    if (cancelled) message.value = reason
    return cancelled
  }

  function openArrange(): void {
    if (converting.value) return
    const ids = scene.trains.value.map(train => train.id)
    if (!ids.length) {
      message.value = 'Add x and y rods first.'
      return
    }
    scene.select(ids)
    const opened = preview.open(ids, { name: 'count-arrange' })
    message.value = opened.allowed ? '' : opened.reason
  }

  /** Availability for menu entries and buttons, from the current selection. */
  const conversionAvailability = computed(() => conversion.availability.value)
  const arrangeAvailability = computed(() => {
    const planned = planCountTransform(config.value, scene.trains.value, scene.trains.value.map(train => train.id), { name: 'count-arrange' })
    return planned.allowed ? { allowed: true as const } : planned
  })

  // ---- Preview visuals -------------------------------------------------------

  const previewDetail = computed(() => {
    const session = preview.session.value
    if (!session || !active.value) return null
    const planned = planCountTransform(config.value, scene.trains.value, session.ids, session.transform)
    return planned.allowed ? planned.plan.detail : null
  })

  /** Only exchanged rods read as removed; rods that merely slide stay solid. */
  const previews = computed(() => new Map<string, RodPreview>(
    (previewDetail.value?.exchanged ?? []).map(id => [id, { role: 'removed' }]),
  ))

  return {
    active,
    layout,
    evaluation,
    phase,
    status,
    hint,
    hintLevel,
    nextHint,
    counts,
    derived,
    history,
    step,
    message,
    selectedUnits,
    conversion,
    converting,
    display,
    forgetPrevious,
    initialScene,
    pristine,
    addRods,
    removeRod,
    selectForExchange,
    beginConversion,
    cloneInOrder,
    applyConversion,
    cancelConversion,
    openArrange,
    conversionAvailability,
    arrangeAvailability,
    previewDetail,
    previews,
  }
}
