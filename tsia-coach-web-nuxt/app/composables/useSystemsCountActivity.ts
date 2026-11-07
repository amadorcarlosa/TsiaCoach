import { computed, ref, watch, type DeepReadonly, type Ref } from 'vue'
import type { RodPreview } from '~/components/rod/rod.types'
import type { RodTrain } from '~/components/rod/scene/rod.scene.types'
import { exchangeStep, type CandidateCounts } from '~/components/systems/systems.candidates'
import { evaluateCountSystem } from '~/components/systems/systems.count-evaluate'
import { countHint, countPhase, countStatus } from '~/components/systems/systems.count-feedback'
import { countLayout, derivedLowerTrains, unitTrain } from '~/components/systems/systems.count-layout'
import { exchangeSelection, planCountTransform, selectedUnitCount } from '~/components/systems/systems.count-operations'
import { strategyOf, type SystemsBoardConfig, type VariableId } from '~/components/systems/systems.schema'
import type { useBoardTransformPreview } from './useBoardTransformPreview'
import type { useRodScene } from './useRodScene'

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
}) {
  const { config, scene, preview } = options
  const active = computed(() => strategyOf(config.value) === 'rod-count')
  const layout = computed(() => countLayout(config.value))
  const coefficients = computed(() => config.value.system.equations[0].coefficients)
  const evaluation = computed(() => evaluateCountSystem(config.value, scene.trains.value))
  const selectedUnits = computed(() => active.value
    ? selectedUnitCount(config.value, scene.trains.value, scene.selection.value)
    : 0)
  const phase = computed(() => countPhase(evaluation.value, { previewing: preview.active.value, selectedUnits: selectedUnits.value }))
  const status = computed(() => countStatus(config.value, evaluation.value, phase.value, selectedUnits.value))
  const step = computed(() => exchangeStep(coefficients.value.x, coefficients.value.y))
  const message = ref('')

  const hintLevel = ref(0)
  const hint = computed(() => hintLevel.value ? countHint(config.value, evaluation.value, hintLevel.value) : '')
  // A new candidate or problem starts the hints over.
  watch(() => [config.value, evaluation.value.valid && evaluation.value.candidate?.xCount], () => { hintLevel.value = 0 })
  function nextHint(): void {
    hintLevel.value = Math.min(3, hintLevel.value + 1)
  }

  const counts = computed<CandidateCounts>(() => evaluation.value.valid ? evaluation.value.counts : { xCount: 0, yCount: 0 })

  /** Equation 2 for the same counts. Decorative, never scene data or saved. */
  const derived = computed<RodTrain[]>(() => active.value && evaluation.value.valid && evaluation.value.clean
    ? derivedLowerTrains(config.value, counts.value)
    : [])

  /** Candidates reached so far: the sequence up to the current one. */
  const history = computed<readonly CandidateCounts[]>(() => {
    const current = evaluation.value
    if (!current.valid || current.candidateIndex < 0) return []
    const { analysis } = current
    const sequence = analysis.status === 'solvable' || analysis.status === 'no-common-solution' ? analysis.sequence : []
    return sequence.slice(0, current.candidateIndex + 1)
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
    if (options.blocked()) return
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
    if (created.length) {
      scene.select(created)
      if (created.length === count) message.value = `Added ${count} ${variable} rod${count === 1 ? '' : 's'} (${valueOf(variable)}-rod${count === 1 ? '' : 's'}).`
    }
  }

  /** Removes the rightmost single x or y rod. */
  function removeRod(variable: VariableId): void {
    if (options.blocked() || !evaluation.value.valid) return
    const units = evaluation.value.material.units
    const single = scene.trains.value
      .filter(train => train.parts.length === 1 && units.some(unit => unit.trainId === train.id && unit.variable === variable))
      .sort((p, q) => q.anchor.x - p.anchor.x)[0]
    if (!single) {
      message.value = `There is no separate ${variable} rod to remove.`
      return
    }
    const result = scene.apply([single.id], { type: 'delete' })
    message.value = result.allowed ? `Removed one ${variable} rod.` : result.reason
  }

  // ---- Exchange ---------------------------------------------------------------

  /** Selects the rightmost x rods that make exactly one exchange. */
  function selectForExchange(): boolean {
    if (options.blocked()) return false
    const result = exchangeSelection(config.value, scene.trains.value)
    if ('reason' in result) {
      message.value = result.reason
      return false
    }
    scene.select(result.ids)
    message.value = `Selected ${step.value.removedX} x rods to exchange.`
    return true
  }

  // The preview guards editing itself; options.blocked() is also true while
  // the context menu that opens these is still closing.
  function openExchange(): void {
    const opened = preview.open([...scene.selection.value], { name: 'count-exchange' })
    message.value = opened.allowed ? '' : opened.reason
  }

  function openArrange(): void {
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
  const exchangeAvailability = computed(() => {
    const planned = planCountTransform(config.value, scene.trains.value, [...scene.selection.value], { name: 'count-exchange' })
    return planned.allowed ? { allowed: true as const } : planned
  })
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
    initialScene,
    pristine,
    addRods,
    removeRod,
    selectForExchange,
    openExchange,
    openArrange,
    exchangeAvailability,
    arrangeAvailability,
    previewDetail,
    previews,
  }
}
