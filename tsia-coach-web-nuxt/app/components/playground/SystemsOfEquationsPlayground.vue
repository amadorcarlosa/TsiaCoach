<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import BoardViewControls from '~/components/grid/BoardViewControls.vue'
import { clientPointToGrid, measureGridFrame } from '~/components/grid/grid-coordinates'
import type { Point } from '~/components/grid/gridPointer'
import ArrayPlaygroundShell from '~/components/playground/ArrayPlaygroundShell.vue'
import PlaygroundActionButton from '~/components/playground/PlaygroundActionButton.vue'
import RodPlaygroundAuthoring from '~/components/playground/RodPlaygroundAuthoring.vue'
import { createSystemsGoalAdapter } from '~/components/playground/goals/board-goal-adapters'
import type { BoardGoalAdapter } from '~/components/playground/goals/goal.types'
import type { BoardDescriptor, LevelDocumentAdapter } from '~/components/playground/files/level-document'
import { playgroundBoardLayout, type RodPlaygroundExposed } from '~/components/playground/playground.types'
import type { ArrayRodOrientation } from '~/components/rod/array/array-rod.types'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import PreviewDialog from '~/components/rod/scene/PreviewDialog.vue'
import SceneMenu from '~/components/rod/scene/SceneMenu.vue'
import SceneRodLayer from '~/components/rod/scene/SceneRodLayer.vue'
import { cellBounds } from '~/components/rod/scene/rectangle-operations'
import { areaGroupPartitions, areaGroupingOf, tiledRectangle } from '~/components/tabla/area-grouping'
import {
  baseRodMenuChoices,
  deleteMenuChoice,
  orientationMenuChoices,
  rectangleRodMenuChoices,
} from '~/components/rod/scene/rod-menu-choices'
import type { BoardTransform, RodTrain, SceneResult, ScenePolicy } from '~/components/rod/scene/rod.scene.types'
import type { SceneMenuChoice, SceneMenuCommand, SceneMenuRequest } from '~/components/rod/scene/scene-menu.types'
import type { SceneSnapshot } from '~/components/rod/scene/scene-snapshot'
import { regionAt, trainFitsRegion } from '~/components/rod/scene/scene-regions'
import { trainView } from '~/components/rod/scene/train-view'
import { validateSnapshot } from '~/components/rod/scene/validate-snapshot'
import SystemsProblemEditor from '~/components/systems/SystemsProblemEditor.vue'
import SystemsCountBoard from '~/components/systems/SystemsCountBoard.vue'
import SystemsCountConversionTools from '~/components/systems/SystemsCountConversionTools.vue'
import SystemsCountPanel from '~/components/systems/SystemsCountPanel.vue'
import SystemsCountSummaries from '~/components/systems/SystemsCountSummaries.vue'
import { COUNT_REGION_ID, countLayout } from '~/components/systems/systems.count-layout'
import { generateSystem, randomSeed } from '~/components/systems/systems.generator'
import {
  strategyOf,
  systemsBoardConfigSchema,
  type DifficultyProfile,
  type SystemsBoardConfig,
  type SystemsStrategy,
  type VariableId,
} from '~/components/systems/systems.schema'
import SystemsBoard from '~/components/systems/SystemsBoard.vue'
import { substituteSystem } from '~/components/systems/systems.substitution'
import SystemsAreaSummaries from '~/components/systems/SystemsAreaSummaries.vue'
import { evaluateSystem } from '~/components/systems/systems.evaluate'
import { agreementFeedback, equationFeedback, groupFeedback, systemFeedback } from '~/components/systems/systems.feedback'
import { systemsFixtures, type SystemsFixtureId } from '~/components/systems/systems.fixtures'
import { equationText, systemsGeometry } from '~/components/systems/systems.geometry'
import {
  planSystemsTransform,
  redistributionOptions,
  systemsReasons,
  type SystemsTransformName,
} from '~/components/systems/systems.operations'
import { useActiveScene } from '~/composables/useActiveScene'
import { useAreaGroupingMenuChoice } from '~/composables/useAreaGroupingMenuChoice'
import { useBoardCamera } from '~/composables/useBoardCamera'
import { useBoardLayout } from '~/composables/useBoardLayout'
import { useBoardTransformPreview } from '~/composables/useBoardTransformPreview'
import { useFactorMenuChoice } from '~/composables/useFactorMenuChoice'
import { usePlaygroundElementRefs } from '~/composables/usePlaygroundElementRefs'
import { useRodPlaygroundInteraction } from '~/composables/useRodPlaygroundInteraction'
import { useRectangleMenuChoice } from '~/composables/useRectangleMenuChoice'
import { useRodScene } from '~/composables/useRodScene'
import { useSystemsCountActivity } from '~/composables/useSystemsCountActivity'

const props = withDefaults(defineProps<{
  active?: boolean
  showAuthoring?: boolean
  cancelVersion?: () => number
  /** Fixed per tab: each tab reads its boards under one strategy. */
  strategy?: SystemsStrategy
}>(), {
  active: true,
  showAuthoring: true,
  strategy: 'row-length',
  cancelVersion: undefined,
})

const copyConfig = (config: SystemsBoardConfig): SystemsBoardConfig => JSON.parse(JSON.stringify(config))

/** Key order differs after schema parsing, so compare a key-sorted form. */
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : item)
const fixtureOf = (target: SystemsBoardConfig) => (Object.keys(systemsFixtures) as SystemsFixtureId[])
  .find(id => canonical(systemsFixtures[id].config) === canonical(target)) ?? null

// The problem is fixed while it has rods or captured steps; see setProblem().
const initialFixture: SystemsFixtureId = props.strategy === 'rod-count' ? 'rodCountReference' : 'development'
const fixtureId = ref<SystemsFixtureId | null>(initialFixture)
const config = shallowRef<SystemsBoardConfig>(copyConfig(systemsFixtures[initialFixture].config))
const geometry = computed(() => systemsGeometry(config.value))
const activeStrategy = computed<SystemsStrategy>(() => strategyOf(config.value))
const countMode = computed(() => activeStrategy.value === 'rod-count')

/** What the scene needs from either strategy's layout. */
function shapeOf(target: SystemsBoardConfig) {
  if (strategyOf(target) === 'rod-count') {
    const layout = countLayout(target)
    return { columns: layout.columns, rows: layout.rows, regions: layout.regions, spawnRow: layout.upper.y }
  }
  const layout = systemsGeometry(target)
  return {
    columns: layout.columns,
    rows: layout.rows,
    regions: layout.regions,
    spawnRow: layout.staging?.y ?? layout.variableRegions[0]!.y,
  }
}
const shape = computed(() => shapeOf(config.value))
const problemMessage = ref('')
const authoringPanel = ref<InstanceType<typeof RodPlaygroundAuthoring> | null>(null)
const orientations = ['horizontal', 'vertical', 'tower'] as const

const { boardViewport, workspaceTools, setBoardViewport, setWorkspaceTools } = usePlaygroundElementRefs()

const initialGeometry = systemsGeometry(config.value)
const { phonePortrait, trayOpen, cellSize: baseCellSize, boardPaddingY } = useBoardLayout({
  ...playgroundBoardLayout,
  boardViewport,
  workspaceTools,
  fullColumns: initialGeometry.columns,
  totalRows: initialGeometry.rows,
})

const editingDisabled = computed(() => !props.active || phonePortrait.value)

/** Commands are planned from the problem they will run under. */
function planTransform(target: SystemsBoardConfig) {
  return (trains: readonly RodTrain[], ids: readonly string[], transform: BoardTransform) => {
    const result = planSystemsTransform(target, trains, ids, transform)
    return result.allowed
      ? { allowed: true as const, remove: result.plan.remove, add: result.plan.add }
      : result
  }
}

function policyFor(target: SystemsBoardConfig): ScenePolicy {
  const layout = shapeOf(target)
  return {
    columns: layout.columns,
    rows: layout.rows,
    spawnRows: [layout.spawnRow],
    regions: layout.regions,
    editable: () => !editingDisabled.value,
    allowOrientation: true,
    allowFactors: true,
    // Groups carry meaning: joins and clones stay in the group they came from.
    regionBoundEdits: true,
    planTransform: planTransform(target),
  }
}

// Read through on every use, so a problem change applies everywhere at once.
const policy: ScenePolicy = {
  get columns() { return shape.value.columns },
  get rows() { return shape.value.rows },
  get spawnRows() { return [shape.value.spawnRow] },
  get regions() { return shape.value.regions },
  editable: () => !editingDisabled.value,
  allowOrientation: true,
  allowFactors: true,
  // Rod-count boards also offer area work in the ordinary menu.
  get allowAreaRegroup() { return countMode.value },
  get allowRectangles() { return countMode.value },
  regionBoundEdits: true,
  planTransform: (trains, ids, transform) => planTransform(config.value)(trains, ids, transform),
}
const scene = useRodScene(policy)

const preview = useBoardTransformPreview({
  scene,
  viewport: boardViewport,
  disabled: () => editingDisabled.value,
  beforeOpen: () => {
    controls.cancelGestures()
    controls.menu.close()
  },
  plan: (ids, transform) => planSystemsTransform(config.value, scene.trains.value, ids, transform),
  staleReason: systemsReasons.stale,
})

const count = useSystemsCountActivity({
  config,
  scene,
  preview,
  blocked: () => blocked.value || editingDisabled.value,
  editable: () => !editingDisabled.value,
})
const conversion = count.conversion

// One editing target: the committed scene, or the conversion draft while one
// is open. Every tool (tray, toolbar, menus, marquee, keyboard, touch) binds
// to it, so none can stay attached to the other scene.
const editing = useActiveScene(() => conversion.active.value ? conversion.draft : scene)

const controls = useRodPlaygroundInteraction({
  scene: editing,
  viewport: boardViewport,
  disabled: () => editingDisabled.value || preview.active.value,
  cancelVersion: () => props.cancelVersion?.() ?? 0,
  onBoardClick,
  // Rods outside an open conversion are context: visible, never input.
  eligible: id => !conversion.protectedIds.value.has(id),
})
const {
  menu, marquee, blocked, checkSelected, applySelected, addendMenuChoice,
  captureScene: captureCommitted, replaceScene: replaceCommitted,
} = controls

// Rod-count activities begin with one rod of each type, placed once the tab can edit.
let started = false
watch(editingDisabled, disabled => {
  if (started || disabled || !countMode.value) return
  started = true
  if (!scene.trains.value.length) replaceScene(count.initialScene())
}, { immediate: true })

// Previews and conversion drafts never reach authoring, capture or import:
// both close first, so only committed material is read or replaced.
function captureScene() {
  count.cancelConversion('')
  preview.dismiss('', false)
  return captureCommitted()
}
function replaceScene(source: SceneSnapshot) {
  count.cancelConversion('')
  preview.dismiss('', false)
  const result = replaceCommitted(source)
  // A retained previous candidate belongs to the old material; restored
  // material that is itself a candidate rebuilds it.
  if (result.allowed) count.forgetPrevious()
  return result
}

/** Focus the first of these rods once they render, for keyboard continuity. */
function focusPieces(ids: readonly string[]): void {
  const id = ids[0]
  if (!id) return
  void nextTick(() => {
    boardViewport.value?.querySelector<HTMLElement>(`[data-piece-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true })
  })
}

function beginConversion(): void {
  controls.cancelGestures()
  menu.close()
  if (count.beginConversion()) focusPieces(conversion.session.value?.sourceIds ?? [])
}

function applyConversion(): void {
  controls.cancelGestures()
  const result = count.applyConversion()
  if (result.allowed) focusPieces(result.createdIds)
}

function cancelConversion(): void {
  const sources = conversion.session.value?.sourceIds ?? []
  controls.cancelGestures()
  menu.close()
  if (count.cancelConversion()) focusPieces(sources)
}

watch(editingDisabled, disabled => {
  if (disabled) count.cancelConversion('Conversion cancelled: editing became unavailable. Nothing changed.')
})

// ---- Problem, initial scene, reset and clear --------------------------------

const board = computed((): BoardDescriptor => ({ kind: 'systems', config: copyConfig(config.value) }))

function adapterFor(target: SystemsBoardConfig): LevelDocumentAdapter {
  return {
    board: { kind: 'systems', config: copyConfig(target) },
    goals: createSystemsGoalAdapter(target),
    validateSnapshot: snapshot => validateSnapshot(snapshot, policyFor(target)),
  }
}

function cancelViewGestures() {
  preview.dismiss()
  controls.cancelGestures()
  menu.close()
  regionMenu.value = null
}

function resetScene(): void {
  if (blocked.value) return
  // Rod-count activities begin with one rod of each type.
  const result = replaceScene(countMode.value ? count.initialScene() : [])
  problemMessage.value = result.allowed
    ? countMode.value
      ? 'Board reset to one x rod and one y rod. Captured steps are unchanged.'
      : 'Board reset to an empty grid. Captured steps are unchanged.'
    : result.reason
}

function clearScene(): void {
  if (blocked.value) return
  const result = replaceScene([])
  problemMessage.value = result.allowed ? 'Board cleared. The equations and captured steps are unchanged.' : result.reason
}

/**
 * Switching problems reinterprets every lane, so it is refused while rods or
 * captured steps exist rather than silently giving old rods a new meaning.
 */
function applyProblem(target: SystemsBoardConfig): void {
  if (blocked.value || editingDisabled.value) return
  const parsed = systemsBoardConfigSchema.safeParse(target)
  if (!parsed.success) {
    problemMessage.value = 'Check the equation coefficients, totals and row capacity.'
    return
  }
  if (!count.pristine() || (authoringPanel.value?.stepCount() ?? 0) > 0) {
    problemMessage.value = 'Clear the board and delete captured steps before switching problems.'
    return
  }
  cancelViewGestures()
  config.value = copyConfig(parsed.data)
  fixtureId.value = fixtureOf(config.value)
  replaceScene(strategyOf(config.value) === 'rod-count' ? count.initialScene(config.value) : [])
  problemMessage.value = `Problem changed to ${config.value.system.equations.map(equationText).join(', ')}.`
  void camera.reset()
}

function setProblem(id: SystemsFixtureId): void {
  if (id === fixtureId.value) return
  applyProblem(systemsFixtures[id].config)
}

const fixtureIds = Object.keys(systemsFixtures) as SystemsFixtureId[]
const visibleFixtures = computed(() => fixtureIds
  .filter(id => strategyOf(systemsFixtures[id].config) === activeStrategy.value)
  .map(id => ({ id, label: systemsFixtures[id].label })))


/** New generated problem, through the same guarded transition as any switch. */
function generateProblem(profile: DifficultyProfile): void {
  if (blocked.value || editingDisabled.value) return
  const result = generateSystem(randomSeed(), profile)
  if (!result.ok) {
    problemMessage.value = result.reason
    return
  }
  applyProblem(result.config)
}

// An imported level brings its own problem; the import replaces the whole
// board and its steps, so nothing old is reinterpreted.
const adoptBoard = {
  adapterFor: (target: BoardDescriptor) => target.kind === 'systems' ? adapterFor(target.config) : null,
  apply: (target: BoardDescriptor) => {
    if (target.kind !== 'systems') return () => {}
    const before = { config: config.value, fixtureId: fixtureId.value }
    count.cancelConversion('')
    cancelViewGestures()
    config.value = copyConfig(target.config)
    fixtureId.value = fixtureOf(target.config)
    return () => {
      config.value = before.config
      fixtureId.value = before.fixtureId
    }
  },
}

const currentGoals = computed(() => createSystemsGoalAdapter(config.value))
const goalAdapter: BoardGoalAdapter = {
  get regions() { return currentGoals.value.regions },
  get pairs() { return currentGoals.value.pairs },
  get supportedTypes() { return currentGoals.value.supportedTypes },
  get signedRegionTotals() { return currentGoals.value.signedRegionTotals },
  parse: input => currentGoals.value.parse(input),
  evaluate: (goal, snapshot) => currentGoals.value.evaluate(goal, snapshot),
}

defineExpose<RodPlaygroundExposed>({
  capture: () => ({ board: board.value, trains: captureScene() }),
  clear: () => replaceScene([]),
})

// ---- Camera -----------------------------------------------------------------

const camera = useBoardCamera({
  viewport: boardViewport,
  baseCellSize: () => config.value.layout === 'continuous' ? Math.min(24, baseCellSize.value) : baseCellSize.value,
  disabled: () => editingDisabled.value,
  beforeChange: cancelViewGestures,
})
const cellSize = camera.cellSize
const boardScrollTop = ref(0)

function onBoardScroll() {
  boardScrollTop.value = boardViewport.value?.scrollTop ?? 0
  cancelViewGestures()
}

function onBoardPointerDown(event: PointerEvent) {
  if (!camera.onPointerDown(event)) marquee.onPointerDown(event)
}
function onBoardLostPointerCapture(event: PointerEvent) {
  camera.onPointerEnd(event)
  marquee.onLostPointerCapture(event)
}
watch(editingDisabled, disabled => {
  if (disabled) camera.endPan()
})

// ---- Evaluation and readouts ------------------------------------------------

const evaluation = computed(() => evaluateSystem(config.value, scene.trains.value))
const substitution = computed(() => substituteSystem(config.value, scene.trains.value))
const equationRows = computed(() => config.value.system.equations.map((equation, index) => {
  const evaluated = evaluation.value.valid ? evaluation.value.equations[index]! : null
  return {
    id: equation.id,
    text: `Equation ${index + 1}: ${equationText(equation)}`,
    summary: evaluated ? equationFeedback(evaluated) : '',
    groups: evaluated ? [groupFeedback(evaluated.groups.x), groupFeedback(evaluated.groups.y)] : [],
  }
}))
const agreementRows = computed(() => evaluation.value.valid
  ? [agreementFeedback(evaluation.value, 'x'), agreementFeedback(evaluation.value, 'y')]
  : [])
const stagingReadout = computed(() => geometry.value.staging && evaluation.value.valid
  ? `Staging: ${evaluation.value.stagingArea} cells, not counted`
  : '')

// ---- Creation destination ---------------------------------------------------

const defaultRegion = () => countMode.value ? COUNT_REGION_ID : geometry.value.variableRegions[0]!.id
const activeRegion = ref<string>(defaultRegion())
watch(shape, layout => {
  if (!layout.regions.some(region => region.id === activeRegion.value)) activeRegion.value = defaultRegion()
})
const destinations = computed(() => [
  ...geometry.value.variableRegions.map(region => ({
    id: region.id,
    label: `Eq ${region.equationIndex + 1}: ${region.variable} (${region.coefficient} ${region.coefficient === 1 ? 'row' : 'rows'})`,
  })),
  ...(geometry.value.staging ? [{ id: geometry.value.staging.id, label: 'Staging' }] : []),
])

function onBoardClick(point: Point): void {
  if (blocked.value) return
  const region = regionAt(shape.value.regions, point)
  if (region) activeRegion.value = region.id
}

function onChoose(value: CuisenaireRodValue): void {
  if (blocked.value) return
  // During a conversion new rods are draft experiments, never committed.
  const result = editing.apply([], { type: 'create', value, regionId: activeRegion.value })
  if (result.allowed) editing.select(result.createdIds)
}

// ---- Train context menu -----------------------------------------------------

const factorMenuChoice = useFactorMenuChoice(editing, true)
const renderedPieces = computed(() => editing.trains.value.map(trainView))
const selectedRod = computed(() => editing.selection.value.size === 1
  ? renderedPieces.value.find(piece => editing.selection.value.has(piece.id))
  : undefined)

/** Planner first, then the full scene check that commit will repeat. */
function availability(ids: readonly string[], transform: BoardTransform): SceneResult {
  const planned = planSystemsTransform(config.value, scene.trains.value, ids, transform)
  if (!planned.allowed) return planned
  return scene.check(ids, { type: 'board-transform', transform: { ...transform, expected: planned.plan.key } })
}

const commandNames: Partial<Record<SceneMenuCommand, SystemsTransformName>> = {
  'systems-count-exchange': 'count-exchange',
  'systems-count-arrange': 'count-arrange',
  'systems-repeat-row': 'repeat-row',
  'systems-arrange-rows': 'arrange-rows',
  'systems-redistribute': 'redistribute',
  'systems-test-candidate': 'test-candidate',
}

const systemsChoices = computed<SceneMenuChoice[]>(() => {
  if (countMode.value) return countChoices.value
  const ids = [...scene.selection.value]
  const command = (label: string, name: SceneMenuCommand, transform: SystemsTransformName): SceneMenuChoice => ({
    kind: 'command', label, command: name, result: availability(ids, { name: transform }),
  })
  const options = redistributionOptions(config.value, scene.trains.value, ids)
  const redistribute: SceneMenuChoice = options.allowed
    ? {
        kind: 'submenu',
        label: 'Redistribute this equation’s area',
        children: options.pairs.map(([x, y]) => ({
          kind: 'command' as const,
          label: `x = ${x}, y = ${y}`,
          command: 'systems-redistribute' as const,
          params: { x, y },
          result: availability(ids, { name: 'redistribute', params: { x, y } }),
        })),
      }
    : { kind: 'submenu', label: 'Redistribute this equation’s area', children: [], disabledReason: options.reason }
  return [
    command('Repeat row into this group', 'systems-repeat-row', 'repeat-row'),
    command('Arrange as coefficient rows', 'systems-arrange-rows', 'arrange-rows'),
    redistribute,
    command('Test candidate in other equation', 'systems-test-candidate', 'test-candidate'),
  ]
})

const countChoices = computed<SceneMenuChoice[]>(() => [
  {
    kind: 'command',
    label: `Convert selected area… (${count.step.value.removedX} x rods · ${count.step.value.preservedArea} cells)`,
    command: 'systems-count-convert',
    result: count.conversionAvailability.value,
  },
  {
    kind: 'command',
    label: 'Arrange x rods, then y rods',
    command: 'systems-count-arrange',
    result: count.arrangeAvailability.value,
  },
])

// ---- Conversion workspace menu ----------------------------------------------

/** The rectangle whose columns are this problem's y rods: addedY columns of b rows. */
const countTargetShape = computed(() => countMode.value
  ? { rows: config.value.system.equations[0].coefficients.y, columns: count.step.value.addedY }
  : null)
const rectangleMenuChoice = useRectangleMenuChoice(editing, () => {
  const target = countTargetShape.value
  return target ? shape => shape.rows === target.rows && shape.columns === target.columns : undefined
})
const groupMenuChoice = useAreaGroupingMenuChoice(editing, 'Group rectangle', (reading, current) => {
  const target = countTargetShape.value
  const isTarget = target !== null && reading.grouping === 'columns' && reading.count === target.columns && reading.unitsPerGroup === target.rows
  return [isTarget ? 'target y grouping' : '', current ? 'current grouping' : ''].filter(Boolean).join(', ') || undefined
})
const conversionCommands = computed<SceneMenuChoice[]>(() => {
  const state = conversion.assessment.value
  return [
    {
      kind: 'command',
      label: 'Apply conversion',
      command: 'systems-count-apply-conversion',
      result: state?.ready ? { allowed: true } : { allowed: false, reason: state?.reason ?? 'No conversion is open.' },
    },
    { kind: 'command', label: 'Cancel conversion', command: 'systems-count-cancel-conversion', result: { allowed: true } },
  ]
})

const menuChoices = computed<SceneMenuChoice[]>(() => conversion.active.value
  ? [
      ...rectangleRodMenuChoices(addendMenuChoice.value, rectangleMenuChoice.value),
      factorMenuChoice.value,
      groupMenuChoice.value,
      ...conversionCommands.value,
      ...orientationMenuChoices(orientations, selectedRod.value?.orientation),
      deleteMenuChoice,
    ]
  : [
      ...baseRodMenuChoices(addendMenuChoice.value),
      factorMenuChoice.value,
      ...(countMode.value ? [rectangleMenuChoice.value, groupMenuChoice.value] : []),
      ...systemsChoices.value,
      ...orientationMenuChoices(orientations, selectedRod.value?.orientation),
      deleteMenuChoice,
    ])

const conversionMenuCommands: Partial<Record<SceneMenuCommand, () => void>> = {
  'systems-count-convert': beginConversion,
  'systems-count-apply-conversion': applyConversion,
  'systems-count-cancel-conversion': cancelConversion,
}

/** The open conversion's material, outlined on the board with its area. */
const workspaceBox = computed(() => {
  const material = conversion.material.value
  const state = conversion.assessment.value
  if (!material.length || !state) return null
  return { ...cellBounds(material), label: `${state.area} cells` }
})

/**
 * The target grouping's boundaries, drawn over a rectangle that already has
 * the target shape but not yet that grouping. Decorative; the menu and the
 * workspace status carry the same information as text.
 */
const partitionPreview = computed(() => {
  const material = conversion.material.value
  const target = conversion.suggestedShape.value
  const train = material.length === 1 ? material[0]! : null
  if (!train || !target || conversion.assessment.value?.ready) return []
  const rectangle = tiledRectangle(train)
  if (!rectangle || rectangle.width !== target.columns || rectangle.depth !== target.rows) return []
  if (areaGroupingOf(train) === 'columns') return []
  return (areaGroupPartitions(rectangle, 'columns') ?? []).map(band => ({
    x: train.anchor.x + band.offset.x,
    y: train.anchor.y + band.offset.y,
    width: band.width,
    depth: band.depth,
  }))
})

function onMenuCommand(command: SceneMenuCommand, params?: Readonly<Record<string, number>>): void {
  const conversionCommand = conversionMenuCommands[command]
  if (conversionCommand) {
    conversionCommand()
    return
  }
  const name = commandNames[command]
  if (!name) return
  if (name === 'count-arrange') {
    count.openArrange()
    return
  }
  // Exchanges happen only through the conversion workspace.
  if (name === 'count-exchange') return
  preview.open([...scene.selection.value], { name, ...(params ? { params } : {}) })
}

const confirmLabels: Record<SystemsTransformName, string> = {
  'repeat-row': 'Repeat row',
  'arrange-rows': 'Arrange rows',
  'redistribute': 'Redistribute',
  'test-candidate': 'Build candidate',
  'count-exchange': 'Exchange rods',
  'count-arrange': 'Arrange rods',
}
const previewSession = preview.session
const previewDescription = computed(() => {
  const session = previewSession.value
  if (!session) return ''
  if (session.transform.name === 'count-arrange') return 'No rods are added or removed; dotted outlines show where rods slide.'
  const plan = planSystemsTransform(config.value, scene.trains.value, session.ids, session.transform)
  return plan.allowed && plan.plan.conserves
    ? 'Nothing is added or removed: the same area is rearranged.'
    : 'This adds or replaces material, so the area changes as described.'
})

// ---- Region background menu -------------------------------------------------

const regionMenu = ref<{ regionId: string; request: SceneMenuRequest } | null>(null)

function onBoardContextMenu(event: MouseEvent): void {
  if (blocked.value) return
  const world = boardViewport.value?.querySelector('[data-grid-world]')
  const frame = world ? measureGridFrame(world) : null
  const point = frame ? clientPointToGrid({ x: event.clientX, y: event.clientY }, frame) : null
  const region = point ? regionAt(shape.value.regions, point) : undefined
  if (!region) return
  event.preventDefault()
  regionMenu.value = {
    regionId: region.id,
    request: { trainId: '', anchor: { x: event.clientX, y: event.clientY, width: 0, height: 0 } },
  }
}

const regionTrainIds = (regionId: string) => {
  const region = shape.value.regions.find(item => item.id === regionId)
  return region ? scene.trains.value.filter(train => trainFitsRegion(train, region)).map(train => train.id) : []
}

const regionChoices = computed<SceneMenuChoice[]>(() => {
  const target = regionMenu.value
  if (!target) return []
  if (conversion.active.value) return conversionCommands.value
  if (countMode.value) {
    const { x: a, y: b } = config.value.system.equations[0].coefficients
    const phase = count.phase.value
    return [
      { kind: 'command', label: `Add an x rod (${a}-rod)`, command: 'systems-count-add-x', result: { allowed: true } },
      { kind: 'command', label: `Add a y rod (${b}-rod)`, command: 'systems-count-add-y', result: { allowed: true } },
      {
        kind: 'command',
        label: `Select ${count.step.value.removedX} x rods to exchange`,
        command: 'systems-count-select-exchange',
        result: phase === 'reviewing' || phase === 'selecting'
          ? { allowed: true }
          : { allowed: false, reason: phase === 'solved' ? 'Both equations already hold.' : 'Make Equation 1 hold with whole x and y rods first.' },
      },
      { kind: 'command', label: 'Arrange x rods, then y rods', command: 'systems-count-arrange', result: count.arrangeAvailability.value },
    ]
  }
  const label = destinations.value.find(item => item.id === target.regionId)?.label ?? 'this group'
  const trainCount = regionTrainIds(target.regionId).length
  return [
    { kind: 'command', label: `Add rods here (${label})`, command: 'region-add-here', result: { allowed: true } },
    {
      kind: 'command',
      label: 'Select this group’s rods',
      command: 'region-select-group',
      result: trainCount ? { allowed: true } : { allowed: false, reason: 'This group has no rods yet.' },
    },
  ]
})

const countRegionCommands: Partial<Record<SceneMenuCommand, () => void>> = {
  'systems-count-add-x': () => count.addRods('x', 1),
  'systems-count-add-y': () => count.addRods('y', 1),
  'systems-count-select-exchange': () => { count.selectForExchange() },
  'systems-count-arrange': () => count.openArrange(),
  'systems-count-apply-conversion': applyConversion,
  'systems-count-cancel-conversion': cancelConversion,
}

function onRegionCommand(command: SceneMenuCommand): void {
  const target = regionMenu.value
  if (!target) return
  const countCommand = countRegionCommands[command]
  if (countCommand) {
    countCommand()
    return
  }
  if (command === 'region-add-here') {
    activeRegion.value = target.regionId
    trayOpen.value = true
  } else if (command === 'region-select-group') {
    scene.select(regionTrainIds(target.regionId))
  }
}

function onProblemChange(event: Event): void {
  const select = event.target as HTMLSelectElement
  setProblem(select.value as SystemsFixtureId)
  // A refused problem switch must keep the select aligned with the current problem.
  select.value = fixtureId.value ?? ''
}

// ---- Toolbar ----------------------------------------------------------------

function onOrient(orientation: ArrayRodOrientation): void {
  if (blocked.value) return
  applySelected({ type: 'set-orientation', orientation })
}

function onCountAdd(variable: VariableId, amount: number): void {
  count.addRods(variable, amount)
}

function onRemove(): void {
  if (blocked.value) return
  applySelected({ type: 'delete' })
}
</script>

<template>
  <ArrayPlaygroundShell
    :blocked="blocked"
    :can-orient="orientation => !blocked && checkSelected({ type: 'set-orientation', orientation }).allowed"
    :editing-disabled="editingDisabled"
    :message="scene.message.value"
    :orientations="orientations"
    :phone-portrait="phonePortrait"
    :piece-count="renderedPieces.length"
    :total-readout="stagingReadout"
    preview-notice="Portrait preview. Rotate to landscape to edit."
    :remove-disabled="blocked || !checkSelected({ type: 'delete' }).allowed"
    :selected-orientation="selectedRod?.orientation"
    :set-board-viewport="setBoardViewport"
    :set-workspace-tools="setWorkspaceTools"
    toolbar-label="Systems rod controls"
    :tray-id="countMode ? 'rod-count-rod-tray' : 'systems-rod-tray'"
    :tray-open="trayOpen"
    viewport-class="systems-viewport"
    navigable
    :pan-mode="camera.panMode.value"
    @board-pointer-move="camera.onPointerMove"
    @board-pointer-end="camera.onPointerEnd"
    @board-keydown="camera.onKeydown"
    @board-scroll="onBoardScroll"
    @board-lost-pointer-capture="onBoardLostPointerCapture"
    @board-pointer-down="onBoardPointerDown"
    @choose-rod="onChoose"
    @orient="onOrient"
    @remove-selected="onRemove"
    @update-tray-open="trayOpen = $event"
  >
    <template #tools-start>
      <section
        class="sys-readouts"
        aria-label="Equations"
      >
        <ul class="sys-equations">
          <li
            v-for="row in equationRows"
            :key="row.id"
          >
            <strong>{{ row.text }}</strong>
          </li>
        </ul>
      </section>
    </template>

    <template #before-board>
      <div class="sys-compact-controls">
        <label
          v-if="!countMode"
          class="sys-destination"
          role="group"
          aria-label="Rod destination"
        >
          Add rods to
          <select
            v-model="activeRegion"
            :disabled="blocked"
            aria-label="Rod destination"
          >
            <option
              v-for="destination in destinations"
              :key="destination.id"
              :value="destination.id"
            >
              {{ destination.label }}
            </option>
          </select>
        </label>
        <label class="sys-destination">
          Problem
          <select
            :value="fixtureId ?? ''"
            :disabled="blocked || editingDisabled"
            aria-label="Problem"
            @change="onProblemChange"
          >
            <option
              v-if="fixtureId === null"
              value=""
              disabled
            >
              {{ config.generation ? 'Generated problem' : 'Custom / imported problem' }}
            </option>
            <option
              v-for="fixture in visibleFixtures"
              :key="fixture.id"
              :value="fixture.id"
            >
              {{ fixture.label }}
            </option>
          </select>
        </label>
        <details class="sys-problem-options">
          <summary>Board options</summary>
          <div
            class="sys-row"
            role="group"
            aria-label="Board"
          >
            <PlaygroundActionButton
              :disabled="blocked || editingDisabled"
              @click="resetScene"
            >
              Reset board
            </PlaygroundActionButton>
            <PlaygroundActionButton
              :disabled="blocked || editingDisabled"
              @click="clearScene"
            >
              Clear board (keeps equations and steps)
            </PlaygroundActionButton>
          </div>
        </details>
      </div>
      <SystemsProblemEditor
        :config="config"
        :disabled="blocked || editingDisabled"
        @apply="applyProblem"
      />
      <p
        v-if="problemMessage"
        class="sys-note"
        role="status"
      >
        {{ problemMessage }}
      </p>
      <SystemsCountConversionTools
        v-if="conversion.session.value && conversion.assessment.value"
        :coefficients="config.system.equations[0].coefficients"
        :target="config.system.equations[0].targetArea"
        :step="conversion.session.value.step"
        :baseline="conversion.session.value.baselineCounts"
        :next="conversion.session.value.next"
        :assessment="conversion.assessment.value"
        :disabled="editingDisabled"
        @apply="applyConversion"
        @cancel="cancelConversion"
      />
      <BoardViewControls
        :zoom="camera.zoom.value"
        :pan-mode="camera.panMode.value"
        :disabled="editingDisabled"
        @zoom="camera.setZoom"
        @reset="camera.reset"
        @toggle-pan="camera.togglePan"
      />
    </template>

    <template #board>
      <!-- Background right-click only: rods stop their own contextmenu event. -->
      <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
      <div @contextmenu="onBoardContextMenu">
        <SystemsCountBoard
          v-if="countMode"
          :config="config"
          :cell-size="cellSize"
          :evaluation="count.evaluation.value"
          :derived="count.derived.value"
          :preview="count.previewDetail.value"
          :lower-label="count.display.value.label"
          :workspace="workspaceBox"
          :partitions="partitionPreview"
          :viewport-padding="`${boardPaddingY}px 16px`"
        >
          <template #pieces="{ cellSize: pieceCellSize }">
            <SceneRodLayer
              :pieces="renderedPieces"
              :cell-size="pieceCellSize"
              :controls="controls"
              :previews="count.previews.value"
              :inert-ids="conversion.active.value ? conversion.protectedIds.value : null"
            />
          </template>
        </SystemsCountBoard>
        <SystemsBoard
          v-else
          :config="config"
          :cell-size="cellSize"
          :evaluation="substitution.evaluation"
          :suggestions="substitution.suggestions"
          :active-region="activeRegion"
          :ghosts="preview.ghosts.value"
          :viewport-padding="`${boardPaddingY}px 16px`"
        >
          <template #pieces="{ cellSize: pieceCellSize }">
            <SceneRodLayer
              :pieces="renderedPieces"
              :cell-size="pieceCellSize"
              :controls="controls"
              :previews="preview.previews.value"
            />
          </template>
        </SystemsBoard>
      </div>
    </template>

    <template #board-aside>
      <SystemsCountSummaries
        v-if="countMode"
        :config="config"
        :evaluation="count.evaluation.value"
        :display="count.display.value"
        :conversion="conversion.assessment.value?.summary"
        :cell-size="cellSize"
        :padding-y="boardPaddingY"
        :scroll-top="boardScrollTop"
      />
      <SystemsAreaSummaries
        v-else
        :config="config"
        :evaluation="substitution.evaluation"
        :cell-size="cellSize"
        :padding-y="boardPaddingY"
        :scroll-top="boardScrollTop"
      />
    </template>

    <template #menu>
      <SceneMenu
        :request="menu.request.value"
        :selection="menu.selectedIds.value"
        :choices="menuChoices"
        :check="editing.check"
        @action="menu.applyAction"
        @command="onMenuCommand"
        @close="menu.close"
        @restore-focus="menu.restoreFocus"
      />
      <SceneMenu
        :request="regionMenu?.request ?? null"
        :selection="[]"
        :choices="regionChoices"
        :check="scene.check"
        @command="onRegionCommand"
        @close="regionMenu = null"
        @restore-focus="boardViewport?.focus({ preventScroll: true })"
      />
      <PreviewDialog
        :open="previewSession !== null"
        :title="previewSession?.plan.title ?? ''"
        :lines="previewSession?.plan.lines ?? []"
        :description="previewDescription"
        :confirm-label="previewSession ? confirmLabels[previewSession.transform.name as SystemsTransformName] : ''"
        :announcement="preview.announcement.value"
        @confirm="preview.confirm"
        @keep="preview.dismiss()"
      />
    </template>

    <template #after-workspace>
      <SystemsCountPanel
        v-if="countMode"
        :coefficients="config.system.equations[0].coefficients"
        :counts="count.counts.value"
        :phase="count.phase.value"
        :status="count.status.value"
        :hint="count.hint.value"
        :hint-level="count.hintLevel.value"
        :history="count.history.value"
        :step="count.step.value"
        :message="count.message.value"
        :disabled="blocked || editingDisabled || preview.active.value"
        :converting="conversion.active.value"
        :convert="count.conversionAvailability.value"
        :arrange="count.arrangeAvailability.value"
        :generated-profile="config.generation?.profile ?? null"
        @add="onCountAdd"
        @remove="count.removeRod"
        @hint="count.nextHint"
        @select-exchange="count.selectForExchange"
        @convert="beginConversion"
        @arrange="count.openArrange"
        @generate="generateProblem"
      />
      <template v-else>
        <section
          class="sys-feedback"
          aria-label="Variable substitution"
          aria-live="polite"
          aria-atomic="true"
          data-systems-substitution
        >
          <p>Solid rods are yours. Faded, outlined rods show substitution suggestions and are not saved or editable.</p>
          <p
            v-for="line in substitution.lines"
            :key="line"
          >
            {{ line }}
          </p>
        </section>
        <section
          class="sys-feedback"
          aria-label="Constraint feedback"
        >
          <p><strong>Learner material only (excluding substitution suggestions):</strong></p>
          <p
            v-for="row in equationRows"
            :key="row.id"
          >
            {{ row.summary }}
          </p>
          <details class="sys-details">
            <summary>Shape and agreement feedback</summary>
            <ul>
              <template
                v-for="row in equationRows"
                :key="`groups-${row.id}`"
              >
                <li
                  v-for="line in row.groups"
                  :key="line"
                >
                  {{ row.text.split(':')[0] }}: {{ line }}
                </li>
              </template>
              <li
                v-for="line in agreementRows"
                :key="line"
              >
                {{ line }}
              </li>
            </ul>
          </details>
          <p
            class="sys-status"
            role="status"
            aria-live="polite"
            data-systems-status
          >
            {{ systemFeedback(evaluation) }}
          </p>
        </section>
      </template>

      <RodPlaygroundAuthoring
        v-if="showAuthoring"
        ref="authoringPanel"
        :board="board"
        :goal-adapter="goalAdapter"
        :scene="scene"
        :capture-scene="captureScene"
        :replace-scene="replaceScene"
        :blocked="() => blocked"
        :editing-disabled="() => editingDisabled"
        :adopt-board="adoptBoard"
      />
    </template>
  </ArrayPlaygroundShell>
</template>

<style scoped>
.sys-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-block: 4px;
}

.sys-note {
  margin: 0;
  padding-block: 4px;
}

.sys-readouts {
  margin-block: 8px;
}

.sys-equations {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sys-equations li {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
}

.sys-details {
  margin-block: 8px;
}

.sys-details ul {
  margin: 4px 0 0;
  padding-left: 20px;
}

.sys-status {
  margin: 0;
  font-weight: 600;
}
</style>

<style scoped>
.sys-equations { text-align: center; padding-block: 4px; gap: 2px; }
.sys-equations li { justify-content: center; font-size: clamp(18px, 2vw, 26px); }
.sys-compact-controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.sys-destination { display: flex; gap: 8px; align-items: center; font-size: 0.875rem; }
.sys-destination select { min-height: 40px; padding: 6px 10px; border: 1px solid var(--mt-border); border-radius: var(--radius-md); background: var(--mt-bg-elevated); color: var(--mt-text); }
.sys-problem-options { font-size: 0.875rem; }
.sys-feedback { padding-block: 8px; font-size: 0.875rem; }
.sys-feedback p { margin-block: 4px; }
</style>
