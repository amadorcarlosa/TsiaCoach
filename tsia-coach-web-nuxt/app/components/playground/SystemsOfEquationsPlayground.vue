<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
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
import { baseRodMenuChoices, deleteMenuChoice, orientationMenuChoices } from '~/components/rod/scene/rod-menu-choices'
import type { BoardTransform, RodTrain, SceneResult, ScenePolicy } from '~/components/rod/scene/rod.scene.types'
import type { SceneMenuChoice, SceneMenuCommand, SceneMenuRequest } from '~/components/rod/scene/scene-menu.types'
import { copyScene, type SceneSnapshot } from '~/components/rod/scene/scene-snapshot'
import { regionAt, trainFitsRegion } from '~/components/rod/scene/scene-regions'
import { trainView } from '~/components/rod/scene/train-view'
import { validateSnapshot } from '~/components/rod/scene/validate-snapshot'
import SystemsBoard from '~/components/systems/SystemsBoard.vue'
import { evaluateSystem } from '~/components/systems/systems.evaluate'
import { agreementFeedback, equationFeedback, groupFeedback, systemFeedback } from '~/components/systems/systems.feedback'
import { systemsFixtures, type SystemsFixtureId } from '~/components/systems/systems.fixtures'
import { equationText, systemsGeometry, type SystemsGeometry } from '~/components/systems/systems.geometry'
import {
  planSystemsTransform,
  redistributionOptions,
  systemsReasons,
  type SystemsTransformName,
} from '~/components/systems/systems.operations'
import type { SystemsBoardConfig } from '~/components/systems/systems.schema'
import { useBoardCamera } from '~/composables/useBoardCamera'
import { useBoardLayout } from '~/composables/useBoardLayout'
import { useBoardTransformPreview } from '~/composables/useBoardTransformPreview'
import { useFactorMenuChoice } from '~/composables/useFactorMenuChoice'
import { usePlaygroundElementRefs } from '~/composables/usePlaygroundElementRefs'
import { useRodPlaygroundInteraction } from '~/composables/useRodPlaygroundInteraction'
import { useRodScene } from '~/composables/useRodScene'

const props = withDefaults(defineProps<{
  active?: boolean
  showAuthoring?: boolean
  cancelVersion?: () => number
}>(), {
  active: true,
  showAuthoring: true,
  cancelVersion: undefined,
})

const copyConfig = (config: SystemsBoardConfig): SystemsBoardConfig => JSON.parse(JSON.stringify(config))

// The problem is fixed while it has rods or captured steps; see setProblem().
const fixtureId = ref<SystemsFixtureId | null>('development')
const config = shallowRef<SystemsBoardConfig>(copyConfig(systemsFixtures.development.config))
const geometry = computed(() => systemsGeometry(config.value))
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

function policyFor(target: SystemsBoardConfig, layout: SystemsGeometry): ScenePolicy {
  return {
    columns: layout.columns,
    rows: layout.rows,
    spawnRows: [layout.staging.y],
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
  get columns() { return geometry.value.columns },
  get rows() { return geometry.value.rows },
  get spawnRows() { return [geometry.value.staging.y] },
  get regions() { return geometry.value.regions },
  editable: () => !editingDisabled.value,
  allowOrientation: true,
  allowFactors: true,
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

const controls = useRodPlaygroundInteraction({
  scene,
  viewport: boardViewport,
  disabled: () => editingDisabled.value || preview.active.value,
  cancelVersion: () => props.cancelVersion?.() ?? 0,
  onBoardClick,
})
const {
  menu, marquee, blocked, checkSelected, applySelected, addendMenuChoice,
  captureScene: captureCommitted, replaceScene: replaceCommitted,
} = controls

// Previews never reach authoring, capture or import.
function captureScene() {
  preview.dismiss('', false)
  return captureCommitted()
}
function replaceScene(source: SceneSnapshot) {
  preview.dismiss('', false)
  return replaceCommitted(source)
}

// ---- Problem, initial scene, reset and clear --------------------------------

const board = computed((): BoardDescriptor => ({ kind: 'systems', config: copyConfig(config.value) }))

function adapterFor(target: SystemsBoardConfig): LevelDocumentAdapter {
  const layout = systemsGeometry(target)
  return {
    board: { kind: 'systems', config: copyConfig(target) },
    goals: createSystemsGoalAdapter(target),
    validateSnapshot: snapshot => validateSnapshot(snapshot, policyFor(target, layout)),
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
  const result = replaceScene([])
  problemMessage.value = result.allowed ? 'Board reset to an empty grid. Captured steps are unchanged.' : result.reason
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
function setProblem(id: SystemsFixtureId): void {
  if (blocked.value || id === fixtureId.value) return
  const current = JSON.stringify(copyScene(scene.trains.value))
  const untouched = current === '[]'
  if (!untouched || (authoringPanel.value?.stepCount() ?? 0) > 0) {
    problemMessage.value = 'Clear the board and delete captured steps before switching problems.'
    return
  }
  cancelViewGestures()
  config.value = copyConfig(systemsFixtures[id].config)
  fixtureId.value = id
  replaceScene([])
  problemMessage.value = `Problem changed to ${systemsFixtures[id].label}.`
  void camera.reset()
}

// An imported level brings its own problem; the import replaces the whole
// board and its steps, so nothing old is reinterpreted.
const adoptBoard = {
  adapterFor: (target: BoardDescriptor) => target.kind === 'systems' ? adapterFor(target.config) : null,
  apply: (target: BoardDescriptor) => {
    if (target.kind !== 'systems') return () => {}
    const before = { config: config.value, fixtureId: fixtureId.value }
    cancelViewGestures()
    config.value = copyConfig(target.config)
    fixtureId.value = (Object.keys(systemsFixtures) as SystemsFixtureId[])
      .find(key => JSON.stringify(systemsFixtures[key].config) === JSON.stringify(target.config)) ?? null
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
const stagingReadout = computed(() => evaluation.value.valid
  ? `Staging: ${evaluation.value.stagingArea} cells, not counted`
  : '')

// ---- Creation destination ---------------------------------------------------

const activeRegion = ref<string>(geometry.value.variableRegions[0]!.id)
watch(geometry, layout => {
  if (!layout.regions.some(region => region.id === activeRegion.value)) activeRegion.value = layout.variableRegions[0]!.id
})
const destinations = computed(() => [
  ...geometry.value.variableRegions.map(region => ({
    id: region.id,
    label: `Eq ${region.equationIndex + 1}: ${region.variable} (${region.coefficient} ${region.coefficient === 1 ? 'row' : 'rows'})`,
  })),
  { id: geometry.value.staging.id, label: 'Staging' },
])

function onBoardClick(point: Point): void {
  if (blocked.value) return
  const region = regionAt(geometry.value.regions, point)
  if (region) activeRegion.value = region.id
}

function onChoose(value: CuisenaireRodValue): void {
  if (blocked.value) return
  const result = scene.apply([], { type: 'create', value, regionId: activeRegion.value })
  if (result.allowed) scene.select(result.createdIds)
}

// ---- Train context menu -----------------------------------------------------

const factorMenuChoice = useFactorMenuChoice(scene)
const renderedPieces = computed(() => scene.trains.value.map(trainView))
const selectedRod = computed(() => scene.selection.value.size === 1
  ? renderedPieces.value.find(piece => scene.selection.value.has(piece.id))
  : undefined)

/** Planner first, then the full scene check that commit will repeat. */
function availability(ids: readonly string[], transform: BoardTransform): SceneResult {
  const planned = planSystemsTransform(config.value, scene.trains.value, ids, transform)
  if (!planned.allowed) return planned
  return scene.check(ids, { type: 'board-transform', transform: { ...transform, expected: planned.plan.key } })
}

const commandNames: Partial<Record<SceneMenuCommand, SystemsTransformName>> = {
  'systems-repeat-row': 'repeat-row',
  'systems-arrange-rows': 'arrange-rows',
  'systems-redistribute': 'redistribute',
  'systems-test-candidate': 'test-candidate',
}

const systemsChoices = computed<SceneMenuChoice[]>(() => {
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

const menuChoices = computed<SceneMenuChoice[]>(() => [
  ...baseRodMenuChoices(addendMenuChoice.value),
  factorMenuChoice.value,
  ...systemsChoices.value,
  ...orientationMenuChoices(orientations, selectedRod.value?.orientation),
  deleteMenuChoice,
])

function onMenuCommand(command: SceneMenuCommand, params?: Readonly<Record<string, number>>): void {
  const name = commandNames[command]
  if (!name) return
  preview.open([...scene.selection.value], { name, ...(params ? { params } : {}) })
}

const confirmLabels: Record<SystemsTransformName, string> = {
  'repeat-row': 'Repeat row',
  'arrange-rows': 'Arrange rows',
  'redistribute': 'Redistribute',
  'test-candidate': 'Build candidate',
}
const previewSession = preview.session
const previewDescription = computed(() => {
  const session = previewSession.value
  if (!session) return ''
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
  const region = point ? regionAt(geometry.value.regions, point) : undefined
  if (!region) return
  event.preventDefault()
  regionMenu.value = {
    regionId: region.id,
    request: { trainId: '', anchor: { x: event.clientX, y: event.clientY, width: 0, height: 0 } },
  }
}

const regionTrainIds = (regionId: string) => {
  const region = geometry.value.regions.find(item => item.id === regionId)
  return region ? scene.trains.value.filter(train => trainFitsRegion(train, region)).map(train => train.id) : []
}

const regionChoices = computed<SceneMenuChoice[]>(() => {
  const target = regionMenu.value
  if (!target) return []
  const label = destinations.value.find(item => item.id === target.regionId)?.label ?? 'this group'
  const count = regionTrainIds(target.regionId).length
  return [
    { kind: 'command', label: `Add rods here (${label})`, command: 'region-add-here', result: { allowed: true } },
    {
      kind: 'command',
      label: 'Select this group’s rods',
      command: 'region-select-group',
      result: count ? { allowed: true } : { allowed: false, reason: 'This group has no rods yet.' },
    },
  ]
})

function onRegionCommand(command: SceneMenuCommand): void {
  const target = regionMenu.value
  if (!target) return
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
    tray-id="systems-rod-tray"
    :tray-open="trayOpen"
    viewport-class="systems-viewport"
    navigable
    :pan-mode="camera.panMode.value"
    @board-pointer-move="camera.onPointerMove"
    @board-pointer-end="camera.onPointerEnd"
    @board-keydown="camera.onKeydown"
    @board-scroll="cancelViewGestures"
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
              Imported problem
            </option>
            <option
              v-for="(fixture, id) in systemsFixtures"
              :key="id"
              :value="id"
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
      <p
        v-if="problemMessage"
        class="sys-note"
        role="status"
      >
        {{ problemMessage }}
      </p>
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
        <SystemsBoard
          :config="config"
          :cell-size="cellSize"
          :evaluation="evaluation"
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

    <template #menu>
      <SceneMenu
        :request="menu.request.value"
        :selection="menu.selectedIds.value"
        :choices="menuChoices"
        :check="scene.check"
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
      <section
        class="sys-feedback"
        aria-label="Constraint feedback"
      >
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
