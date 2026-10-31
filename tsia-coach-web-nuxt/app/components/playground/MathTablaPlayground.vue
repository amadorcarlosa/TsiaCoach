<script setup lang="ts">
import { createMathTablaGoalAdapter } from './goals/board-goal-adapters'
import { computed, ref } from 'vue'
import MathTablaBoard from '~/components/tabla/MathTablaBoard.vue'
import SceneRodLayer from '~/components/rod/scene/SceneRodLayer.vue'
import SceneMenu from '~/components/rod/scene/SceneMenu.vue'
import PlaygroundActionButton from '~/components/playground/PlaygroundActionButton.vue'
import ArrayPlaygroundShell from '~/components/playground/ArrayPlaygroundShell.vue'
import type { CuisenaireRodValue, RodPresentation } from '~/components/rod/rod.types'
import type { MaterialRole, ScenePolicy } from '~/components/rod/scene/rod.scene.types'
import { layeredRoleOf } from '~/components/rod/scene/rod-scene.placement'
import { validateSnapshot } from '~/components/rod/scene/validate-snapshot'
import type { BoardDescriptor } from '~/components/playground/files/level-document'
import type { ArrayRodOrientation } from '~/components/rod/array/array-rod.types'
import { getMathTablaGeometry } from '~/components/tabla/mathtabla.geometry'
import { getMathTablaReadouts } from '~/components/tabla/mathtabla.readouts'
import { areaGroupReadings, type AreaGrouping } from '~/components/tabla/area-grouping'
import type { Point } from '~/components/grid/gridPointer'
import { trainView } from '~/components/rod/scene/train-view'
import { regionAt, trainFitsRegion } from '~/components/rod/scene/scene-regions'
import { trainFootprints } from '~/components/rod/scene/part-footprint'

import type { SceneMenuChoice } from '~/components/rod/scene/scene-menu.types'
import type { SceneSnapshot } from '~/components/rod/scene/scene-snapshot'
import { useRodScene } from '~/composables/useRodScene'
import { useRodPlaygroundInteraction } from '~/composables/useRodPlaygroundInteraction'
import { useFactorMenuChoice } from '~/composables/useFactorMenuChoice'
import { useAreaGroupingMenuChoice } from '~/composables/useAreaGroupingMenuChoice'
import { useBoardLayout } from '~/composables/useBoardLayout'
import { usePlaygroundElementRefs } from '~/composables/usePlaygroundElementRefs'
import RodPlaygroundAuthoring from '~/components/playground/RodPlaygroundAuthoring.vue'
import { baseRodMenuChoices, deleteMenuChoice, orientationMenuChoices } from '~/components/rod/scene/rod-menu-choices'
import { playgroundBoardLayout, type RodPlaygroundExposed } from '~/components/playground/playground.types'

const props = withDefaults(defineProps<{
  active?: boolean
  showAuthoring?: boolean
  cancelVersion?: () => number
}>(), {
  active: true,
  showAuthoring: true,
  cancelVersion: undefined,
})

const centralColumns = 24
const centralRows = 12
const boardDefinition = getMathTablaGeometry(centralColumns, centralRows)
const fullColumns = boardDefinition.config.columns
const boardRows = boardDefinition.config.rows
const activeRegion = ref('array')
const orientations = ['horizontal', 'vertical'] as const
const destinations = [
  { id: 'horizontal-d', label: 'Horizontal D' },
  { id: 'horizontal-n', label: 'Horizontal N' },
  { id: 'vertical-d', label: 'Vertical D' },
  { id: 'vertical-n', label: 'Vertical N' },
  { id: 'array', label: 'Central array' },
]

const {
  boardViewport,
  workspaceTools,
  setBoardViewport,
  setWorkspaceTools,
} = usePlaygroundElementRefs()

const {
  phonePortrait,
  trayOpen,
  visibleColumns,
  cellSize,
} = useBoardLayout({
  ...playgroundBoardLayout,
  // Two reference columns plus the first 12 central columns.
  portraitColumns: 14,
  boardViewport,
  workspaceTools,
  fullColumns,
  totalRows: boardRows,
})

const editingDisabled = computed(
  () => !props.active || phonePortrait.value,
)

// 'area' is the ordinary activity. Fraction multiplication layers numerator
// rods over denominator tiles inside the whole; the board reads this flag
// rather than inferring the mode from roles, colours or values.
type Activity = 'area' | 'fraction-multiplication'
const activity = ref<Activity>('area')
const layered = computed(() => activity.value === 'fraction-multiplication')
// Rods are what a student places first once the whole exists.
const activeLayer = ref<MaterialRole>('numerator')
const activityNotice = ref('')

const activities: { id: Activity; label: string }[] = [
  { id: 'area', label: 'Area' },
  { id: 'fraction-multiplication', label: 'Fraction multiplication' },
]
const layers: { id: MaterialRole; label: string }[] = [
  { id: 'denominator', label: 'Denominator tiles' },
  { id: 'numerator', label: 'Numerator rods' },
]

const policy: ScenePolicy = {
  columns: fullColumns,
  rows: boardRows,
  spawnRows: Array.from({ length: centralRows }, (_, row) => boardDefinition.array.y + row),
  regions: boardDefinition.regions,
  editable: () => !editingDisabled.value,
  allowOrientation: true,
  allowFactors: true,
  allowAreaRegroup: true,
  layeredRoles: {
    enabled: () => layered.value,
    regionId: 'array',
    // Derived from the candidate scene, so moving a D reference is checked
    // against the numerator rods it would strand.
    wholeOf: trains => getMathTablaReadouts(trains, boardDefinition).guide,
  },
}

const scene = useRodScene(policy)

/** Board cells a train covers, as "x,y" keys. */
function cellsOf(train: (typeof scene.trains.value)[number]): string[] {
  return trainFootprints(train).flatMap(part => {
    const cells: string[] = []
    for (let y = part.y; y < part.y + part.depth; y++) {
      for (let x = part.x; x < part.x + part.width; x++) {
        cells.push(`${x},${y}`)
      }
    }
    return cells
  })
}

// Material on the other layer steps aside only where it lies under or over the
// layer being edited: it stays visible but takes no input there, so the active
// piece is reachable. Uncovered pieces stay editable, and references never
// step aside. Freezing a whole layer would leave most of the board unusable.
const inertIds = computed(() => {
  if (!layered.value) return new Set<string>()

  const active = new Set(
    scene.trains.value
      .filter(train => layeredRoleOf(train, policy) === activeLayer.value)
      .flatMap(cellsOf),
  )

  return new Set(
    scene.trains.value
      .filter(train => {
        const role = layeredRoleOf(train, policy)
        return role !== null && role !== activeLayer.value &&
          cellsOf(train).some(cell => active.has(cell))
      })
      .map(train => train.id),
  )
})

const controls = useRodPlaygroundInteraction({
  scene,
  viewport: boardViewport,
  disabled: () => editingDisabled.value,
  cancelVersion: () => props.cancelVersion?.() ?? 0,
  onBoardClick,
  eligible: id => !inertIds.value.has(id),
})

const {
  menu,
  marquee,
  blocked,
  checkSelected,
  applySelected,
  addendMenuChoice,
  captureScene,
  replaceScene,
} = controls

const goalAdapter = createMathTablaGoalAdapter({ centralColumns, centralRows })
// The activity is part of the board's identity, so a saved level is validated
// under the mode that authored it.
const board = computed((): BoardDescriptor => ({
  kind: 'mathtabla',
  config: {
    centralColumns,
    centralRows,
    ...(layered.value ? { activity: 'fraction-multiplication' as const } : {}),
  },
}))

/** Drop selected pieces that the current layer no longer accepts input from. */
function pruneSelection(): void {
  scene.select([...scene.selection.value].filter(id => !inertIds.value.has(id)))
}

function setActivity(next: Activity): void {
  if (blocked.value || next === activity.value) return

  // The scene must already satisfy the next activity's rules: switching never
  // moves, deletes or reinterprets material.
  const result = validateSnapshot(scene.trains.value, {
    ...policy,
    layeredRoles: { ...policy.layeredRoles!, enabled: () => next === 'fraction-multiplication' },
  })

  if (!result.allowed) {
    const label = activities.find(item => item.id === next)!.label
    activityNotice.value = `The board cannot move to ${label}: ${result.reason}`
    return
  }

  activityNotice.value = ''
  activity.value = next
  menu.close()
  pruneSelection()
}

function setLayer(next: MaterialRole): void {
  if (blocked.value) return
  activeLayer.value = next
  menu.close()
  pruneSelection()
}

// Whole grouping is presentation, not authored data. Until a schema migration
// captures it per step, restoring, importing or clearing starts ungrouped.
const wholeGrouping = ref<AreaGrouping | null>(null)

function restoreScene(source: SceneSnapshot) {
  const result = replaceScene(source)
  if (result.allowed) wholeGrouping.value = null
  return result
}

defineExpose<RodPlaygroundExposed>({ capture: () => ({ board: board.value, trains: captureScene() }), clear: () => restoreScene([]) })

const factorMenuChoice = useFactorMenuChoice(scene)
const areaGroupingMenuChoice = useAreaGroupingMenuChoice(scene)

const message = scene.message
const readouts = computed(() =>
  getMathTablaReadouts(scene.trains.value, boardDefinition, { layered: layered.value }),
)

// Both readings of the current whole, recomputed from the live guide.
const wholeGroupReadings = computed(() => {
  const guide = readouts.value.guide
  if (!guide) return []

  return areaGroupReadings({
    offset: { x: guide.x, y: guide.y },
    width: guide.width,
    depth: guide.depth,
  })
})

const activeWholeGrouping = computed(
  () => readouts.value.guide ? wholeGrouping.value : null,
)

const activeWholeReading = computed(() =>
  wholeGroupReadings.value.find(
    reading => reading.grouping === activeWholeGrouping.value,
  ) ?? null,
)

const groupingUnavailable = computed(() =>
  readouts.value.state === 'ready'
    ? ''
    : readouts.value.state === 'exceeds-board'
      ? 'The whole does not fit this board, so it cannot be grouped yet.'
      : 'Define the whole with both D references before grouping it.',
)

const missingDenominator = computed(() => {
  const missing = orientations.filter(axis => readouts.value[axis].denominator < 1)
  return missing.length === 2
    ? 'Add rods to the horizontal and vertical D tracks to define the whole area.'
    : `Add a rod to the ${missing[0]} D track to define the whole area.`
})

const renderedPieces = computed(() =>
  scene.trains.value.map(trainView),
)

// Presentation follows the track a piece sits on, never its colour or creation
// history, so it is re-derived from live region containment after every move,
// restoration and import:
// - D references are as flat as the area they describe;
// - central material is flat and divided into the unit squares it covers,
//   except numerator rods in fraction multiplication, which stand raised;
// - N references stay raised.
const denominatorRegions = boardDefinition.regions.filter(
  region => region.id === 'horizontal-d' || region.id === 'vertical-d',
)

const presentations = computed(() => new Map<string, RodPresentation>(
  scene.trains.value.flatMap((train): [string, RodPresentation][] => {
    if (denominatorRegions.some(region => trainFitsRegion(train, region))) {
      return [[train.id, 'flat']]
    }
    if (trainFitsRegion(train, boardDefinition.array)) {
      // In fraction multiplication the selected quantity stands raised on
      // the flat, divided tiles of the whole it is selected from.
      return [[train.id, layeredRoleOf(train, policy) === 'numerator' ? 'raised' : 'flat-units']]
    }
    return []
  }),
))

// Denominator tiles paint beneath numerator rods stacked on them. Draw order
// only: scene order, IDs and snapshots are unaffected.
const drawOrder = computed(() => {
  if (!layered.value) return null
  const tiles = new Set(
    scene.trains.value
      .filter(train => layeredRoleOf(train, policy) === 'denominator')
      .map(train => train.id),
  )
  return (piece: { id: string }) => tiles.has(piece.id) ? 0 : 1
})

const selectedRole = computed(() => {
  const id = selectedRod.value?.id
  const train = id ? scene.trains.value.find(item => item.id === id) : undefined
  return train ? layeredRoleOf(train, policy) : null
})

const editingHint = computed(() =>
  `Editing ${layers.find(layer => layer.id === activeLayer.value)!.label.toLowerCase()}. ` +
  'Pieces of the other layer that they cover wait until you switch material.',
)

const selectedRod = computed(() => {
  if (scene.selection.value.size !== 1) return undefined

  return renderedPieces.value.find(
    piece => scene.selection.value.has(piece.id),
  )
})

const menuChoices = computed<SceneMenuChoice[]>(() => [
  ...baseRodMenuChoices(addendMenuChoice.value),
  factorMenuChoice.value,
  areaGroupingMenuChoice.value,
  ...orientationMenuChoices(orientations, selectedRod.value?.orientation),
  // The only way a role changes: an explicit, validated conversion, never a move.
  ...(layered.value
    ? layers.map(layer => ({
        kind: 'action' as const,
        label: `Use as ${layer.label.toLowerCase()}`,
        action: { type: 'set-material-role' as const, materialRole: layer.id },
        checked: selectedRole.value === layer.id,
      }))
    : []),
  deleteMenuChoice,
])

function onBoardClick(point: Point): void {
  if (blocked.value) return
  const region = regionAt(boardDefinition.regions, point)
  if (region) activeRegion.value = region.id
}

function onChoose(value: CuisenaireRodValue): void {
  if (blocked.value) return
  // Creation intent: central material joins the layer being edited.
  const role = layered.value && activeRegion.value === 'array'
    ? { materialRole: activeLayer.value }
    : {}
  const result = scene.apply([], { type: 'create', value, regionId: activeRegion.value, ...role })

  if (result.allowed) {
    scene.select(result.createdIds)
  }
}

function onOrient(orientation: ArrayRodOrientation): void {
  applySelected({ type: 'set-orientation', orientation })
}

function onRemove(): void {
  applySelected({ type: 'delete' })
}
</script>

<template>
  <ArrayPlaygroundShell
    :blocked="blocked"
    :can-orient="orientation => checkSelected({ type: 'set-orientation', orientation }).allowed"
    :editing-disabled="editingDisabled"
    :message="message"
    :orientations="orientations"
    :phone-portrait="phonePortrait"
    :piece-count="renderedPieces.length"
    preview-notice="Portrait preview: two reference columns and the first 12 central-grid columns. Rotate to landscape to edit."
    :remove-disabled="!checkSelected({ type: 'delete' }).allowed"
    scrollable
    :selected-orientation="selectedRod?.orientation"
    :set-board-viewport="setBoardViewport"
    :set-workspace-tools="setWorkspaceTools"
    toolbar-label="MathTabla rod controls"
    tray-id="mathtabla-rod-tray"
    :tray-open="trayOpen"
    viewport-class="math-viewport"
    @board-lost-pointer-capture="marquee.onLostPointerCapture"
    @board-pointer-down="marquee.onPointerDown"
    @choose-rod="onChoose"
    @orient="onOrient"
    @remove-selected="onRemove"
    @update-tray-open="trayOpen = $event"
  >
    <template #tools-start>
      <div
        class="math-destinations"
        role="group"
        aria-label="MathTabla activity"
      >
        <PlaygroundActionButton
          v-for="item in activities"
          :key="item.id"
          :disabled="blocked"
          :pressed="activity === item.id"
          @click="setActivity(item.id)"
        >
          {{ item.label }}
        </PlaygroundActionButton>
      </div>

      <div
        v-if="layered"
        class="math-destinations"
        role="group"
        aria-label="Central material"
      >
        <PlaygroundActionButton
          v-for="layer in layers"
          :key="layer.id"
          :disabled="blocked"
          :pressed="activeLayer === layer.id"
          @click="setLayer(layer.id)"
        >
          {{ layer.label }}
        </PlaygroundActionButton>
      </div>

      <p
        v-if="layered"
        class="math-editing-hint"
      >
        {{ editingHint }}
      </p>

      <p
        class="math-activity-notice"
        role="status"
        aria-live="polite"
      >
        {{ activityNotice }}
      </p>

      <div
        class="math-destinations"
        role="group"
        aria-label="Rod destination"
      >
        <PlaygroundActionButton
          v-for="destination in destinations"
          :key="destination.id"
          :disabled="blocked"
          :pressed="activeRegion === destination.id"
          @click="activeRegion = destination.id"
        >
          {{ destination.label }}
        </PlaygroundActionButton>
      </div>
    </template>

    <template #before-board>
      <div
        class="math-readouts"
        role="group"
        aria-label="MathTabla reference readouts"
      >
        <p>Horizontal reference: N {{ readouts.horizontal.numerator }}, D {{ readouts.horizontal.denominator }}</p>
        <p>Vertical reference: N {{ readouts.vertical.numerator }}, D {{ readouts.vertical.denominator }}</p>
        <template v-if="readouts.guide">
          <p>Whole area: {{ readouts.guide.width }} × {{ readouts.guide.depth }} = {{ readouts.guideCells }} square units</p>
          <p>Covered: {{ readouts.occupiedCells }} of {{ readouts.guideCells }} square units</p>
          <template v-if="layered">
            <p>Denominator tiles: {{ readouts.denominatorCells }} of {{ readouts.guideCells }} square units</p>
            <p>Numerator: {{ readouts.numeratorCells }} of {{ readouts.guideCells }} square units</p>
          </template>
        </template>
        <p v-else-if="readouts.state === 'exceeds-board'">
          Whole exceeds this board: {{ readouts.horizontal.denominator }} × {{ readouts.vertical.denominator }}
          does not fit {{ centralColumns }} × {{ centralRows }} cells.
        </p>
        <p v-else>
          {{ missingDenominator }}
        </p>
      </div>

      <div
        class="math-grouping"
        role="group"
        aria-label="Group the whole"
      >
        <span>Group the whole:</span>
        <PlaygroundActionButton
          :disabled="blocked || !readouts.guide"
          :pressed="activeWholeGrouping === null"
          @click="wholeGrouping = null"
        >
          No grouping
        </PlaygroundActionButton>
        <PlaygroundActionButton
          v-for="reading in wholeGroupReadings"
          :key="reading.grouping"
          :disabled="blocked"
          :pressed="activeWholeGrouping === reading.grouping"
          @click="wholeGrouping = reading.grouping"
        >
          {{ reading.label }} ({{ reading.arrangement }})
        </PlaygroundActionButton>
      </div>

      <!-- Outside the aria-hidden board surface, so the grouping is announced. -->
      <p role="status">
        {{ groupingUnavailable || activeWholeReading?.sentence || 'The whole is not grouped.' }}
      </p>
    </template>

    <template #board>
      <MathTablaBoard
        :rows="centralRows"
        :columns="centralColumns"
        :cell-size="cellSize"
        viewport-padding="16px"
        :active-region="activeRegion"
        :guide="readouts.guide"
        :whole-grouping="activeWholeGrouping"
      >
        <template #pieces="{ cellSize: pieceCellSize }">
          <SceneRodLayer
            :pieces="renderedPieces"
            :cell-size="pieceCellSize"
            :controls="controls"
            :clip-columns="phonePortrait ? visibleColumns : null"
            :presentations="presentations"
            :inert-ids="inertIds"
            :order="drawOrder"
          />
        </template>
      </MathTablaBoard>
    </template>

    <template #menu>
      <SceneMenu
        :request="menu.request.value"
        :selection="menu.selectedIds.value"
        :choices="menuChoices"
        :check="scene.check"
        @action="menu.applyAction"
        @close="menu.close"
        @restore-focus="menu.restoreFocus"
      />
    </template>

    <template #after-workspace>
      <RodPlaygroundAuthoring
        v-if="showAuthoring"
        :board="board"
        :goal-adapter="goalAdapter"
        :scene="scene"
        :capture-scene="captureScene"
        :replace-scene="restoreScene"
        :blocked="() => blocked"
        :editing-disabled="() => editingDisabled"
      />
    </template>
  </ArrayPlaygroundShell>
</template>

<style scoped>
.math-destinations {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  padding: 8px 0;
}

.math-activity-notice,
.math-editing-hint {
  margin: 0;
}

.math-activity-notice:empty {
  display: none;
}

.math-readouts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 24px;
  margin-block: 8px;
}

.math-readouts p {
  margin: 0;
}

.math-grouping {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-block: 8px;
}
</style>
