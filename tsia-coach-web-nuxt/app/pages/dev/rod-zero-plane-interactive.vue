<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import GridSurface from '~/components/grid/surface/GridSurface.vue'
import BoardViewControls from '~/components/grid/BoardViewControls.vue'
import SceneRodLayer from '~/components/rod/scene/SceneRodLayer.vue'
import SceneMenu from '~/components/rod/scene/SceneMenu.vue'
import { useRodScene } from '~/composables/useRodScene'
import { useRodPlaygroundInteraction } from '~/composables/useRodPlaygroundInteraction'
import { useBoardCamera } from '~/composables/useBoardCamera'
import { useFactorMenuChoice } from '~/composables/useFactorMenuChoice'
import { trainView } from '~/components/rod/scene/train-view'
import { partFootprint } from '~/components/rod/scene/part-footprint'
import { partSign, trainSignedTotal } from '~/components/rod/scene/rod-arithmetic'
import { baseRodMenuChoices, deleteMenuChoice, orientationMenuChoices } from '~/components/rod/scene/rod-menu-choices'
import type { RodTrain, RodSign } from '~/components/rod/scene/rod.scene.types'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'

const columns = 36
const rows = 24
const viewport = ref<HTMLElement | null>(null)
// Orthographic CSS tilt preserves the shared affine grid-coordinate mapping.
// A future perspective camera would need projective input conversion.
const tilt = ref(28)
const depth = ref(36)
const transparent = ref(true)
const ready = ref(false)
const cancelVersion = ref(0)
const newSign = ref<RodSign>(1)
const scene = useRodScene({ columns, rows, spawnRows: Array.from({ length: rows }, (_, i) => i), editable: () => true, allowOrientation: true, allowFactors: true, allowNegativeRods: true })
const controls = useRodPlaygroundInteraction({ scene, viewport, disabled: () => false, cancelVersion: () => cancelVersion.value })
function cancelView() {
  controls.cancelGestures()
  controls.menu.close()
  cancelVersion.value++
}
const camera = useBoardCamera({ viewport, baseCellSize: () => 32, disabled: () => false, beforeChange: cancelView })
const cellSize = camera.cellSize
const view = computed(() => ({ depth: depth.value, tilt: tilt.value, transparent: transparent.value }))
const config = computed(() => ({ columns, rows, cellSize: cellSize.value }))
const pieces = computed(() => scene.trains.value.map(trainView))
const factorChoice = useFactorMenuChoice(scene)
const selectedOrientation = computed(() => pieces.value.find(piece => scene.selection.value.size === 1 && scene.selection.value.has(piece.id))?.orientation)
const choices = computed(() => [
  ...baseRodMenuChoices(controls.addendMenuChoice.value),
  factorChoice.value,
  ...orientationMenuChoices(['horizontal', 'vertical'], selectedOrientation.value),
  deleteMenuChoice,
])
const signedTotal = computed(() => scene.trains.value.reduce((sum, train) => sum + trainSignedTotal(train), 0))

function initialScene(): RodTrain[] {
  const trains: RodTrain[] = []
  for (const [index, value] of ([1, 4, 10] as const).entries()) {
    for (const sign of [1, -1] as const) {
      trains.push({ id: `${sign === 1 ? 'positive' : 'negative'}-${value}`, anchor: { x: sign === 1 ? 2 : 19, y: 3 + index * 3 }, parts: [{ value, ...(sign === -1 ? { sign } : {}), orientation: 'horizontal', offset: { x: 0, y: 0 } }] })
    }
  }
  for (const sign of [1, -1] as const) {
    trains.push({ id: `${sign === 1 ? 'positive' : 'negative'}-train`, anchor: { x: sign === 1 ? 2 : 19, y: 13 }, parts: [
      { value: 10, ...(sign === -1 ? { sign } : {}), orientation: 'horizontal', offset: { x: 0, y: 0 } },
      { value: 4, ...(sign === -1 ? { sign } : {}), orientation: 'horizontal', offset: { x: 10, y: 0 } },
    ] })
  }
  return trains
}
function reset() {
  cancelView()
  scene.replace(initialScene())
}
function add(value: CuisenaireRodValue) {
  if (controls.blocked.value) return
  const result = scene.apply([], { type: 'create', value, sign: newSign.value })
  if (result.allowed) scene.select(result.createdIds)
}
function pointerDown(event: PointerEvent) {
  if (!camera.onPointerDown(event)) controls.marquee.onPointerDown(event)
}
function lostCapture(event: PointerEvent) {
  camera.onPointerEnd(event)
  controls.marquee.onLostPointerCapture(event)
}
// Cutouts follow committed geometry AND the shared drag-preview delta.
// The lattice stays at zero; only the opaque backing has openings.
const cutouts = computed(() => {
  const loops = ['0% 0%', '100% 0%', '100% 100%', '0% 100%', '0% 0%']
  for (const train of scene.trains.value) {
    const delta = controls.interaction.previewFor(train.id, true) ?? { x: 0, y: 0 }
    for (const part of train.parts) {
      if (partSign(part) !== -1) continue
      const box = partFootprint(part, { x: train.anchor.x + delta.x, y: train.anchor.y + delta.y })
      const x = box.x / columns * 100, y = box.y / rows * 100
      const right = (box.x + box.width) / columns * 100, bottom = (box.y + box.depth) / rows * 100
      loops.push(`${x}% ${y}%`, `${right}% ${y}%`, `${right}% ${bottom}%`, `${x}% ${bottom}%`, `${x}% ${y}%`, '0% 0%')
    }
  }
  return `polygon(evenodd, ${loops.join(', ')})`
})
watch([tilt, depth, transparent], cancelView, { flush: 'sync' })
onMounted(() => { reset(); ready.value = true })
</script>

<template>
  <main class="interactive-study" :data-ready="ready">
    <NuxtLink to="/dev/rod-zero-plane">Back to visual study</NuxtLink>
    <h1>Move above and below zero.</h1>
    <p>Drag a rod, use arrow keys, or open its context menu. Shift-click to select several. Each train moves as one object.</p>
    <div class="settings" role="group" aria-label="Zero-plane appearance">
      <label>Tilt <input v-model.number="tilt" aria-label="Board tilt" type="range" min="0" max="60"> {{ tilt }}°</label>
      <label>Depth <input v-model.number="depth" aria-label="Rod depth" type="range" min="8" max="36"> {{ depth }} px</label>
      <label><input v-model="transparent" type="checkbox"> Transparent grid</label>
      <button type="button" @click="reset">Reset sample rods</button>
    </div>
    <BoardViewControls :zoom="camera.zoom.value" :pan-mode="camera.panMode.value" @zoom="camera.setZoom" @reset="camera.reset" @toggle-pan="camera.togglePan" />
    <div class="settings" role="group" aria-label="Add sample rods">
      <label>New rods <select v-model.number="newSign"><option :value="1">Positive</option><option :value="-1">Negative</option></select></label>
      <button v-for="value in ([1, 4, 10] as const)" :key="value" type="button" :disabled="controls.blocked.value" @click="add(value)">Add {{ newSign === -1 ? '−' : '+' }}{{ value }}</button>
      <button type="button" :disabled="!controls.checkSelected({ type: 'delete' }).allowed" @click="controls.applySelected({ type: 'delete' })">Remove selected</button>
    </div>
    <!-- Keyboard input here pans only when the viewport itself has focus. -->
    <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
    <div
ref="viewport" class="workspace" :class="{ panning: camera.panMode.value }" role="region" aria-label="Interactive zero-plane board. Arrow keys pan when the workspace is focused." tabindex="0"
      @pointerdown.capture="pointerDown" @pointermove="camera.onPointerMove" @pointerup="camera.onPointerEnd" @pointercancel="camera.onPointerEnd" @lostpointercapture="lostCapture" @keydown="camera.onKeydown" @scroll="cancelView"
    >
      <GridSurface :config="config" :view="{ tiltDegrees: tilt }" :show-grid="false" viewport-alignment="start" viewport-padding="80px 48px">
        <div class="backing" :class="{ transparent }" :style="{ clipPath: cutouts }" aria-hidden="true" />
        <div class="lattice" aria-hidden="true" />
        <SceneRodLayer :pieces="pieces" :cell-size="cellSize" :controls="controls" :zero-plane="view" />
      </GridSurface>
    </div>
    <SceneMenu :request="controls.menu.request.value" :selection="controls.menu.selectedIds.value" :choices="choices" :check="scene.check" @action="controls.menu.applyAction" @close="controls.menu.close" @restore-focus="controls.menu.restoreFocus" />
    <p role="status" aria-live="polite">{{ scene.message.value || `${pieces.length} objects · signed total ${signedTotal}` }}</p>
    <p class="note">Isolated interaction prototype. Depth is a shared view setting, not magnitude. Towers and cancellation are outside this experiment.</p>
  </main>
</template>

<style scoped>
.interactive-study { max-width: 1240px; margin: 24px auto; padding: 24px; }
h1 { font-size: clamp(26px, 4vw, 36px); font-weight: 650; margin: 16px 0 8px; }
.settings { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-block: 14px; }
.settings label { display: flex; align-items: center; gap: 8px; }
.settings button, select { padding: 8px 12px; min-height: 44px; border: 1px solid var(--ui-border); border-radius: 8px; background: var(--ui-bg-elevated); }
input[type=range] { width: 110px; min-height: 44px; accent-color: var(--ui-primary); }
.workspace { height: 560px; overflow: auto; overscroll-behavior: contain; touch-action: none; background: #0b1220; border: 1px solid #344358; border-radius: 10px; }
.workspace:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 3px; }
.workspace :deep([data-grid-world]) { user-select: none; touch-action: none; }
.backing, .lattice { position: absolute; inset: 0; pointer-events: none; }
.backing { background: #182333; }
.backing.transparent { background: transparent; }
.lattice { background-image: linear-gradient(to right, #71809675 1px, transparent 1px), linear-gradient(to bottom, #71809675 1px, transparent 1px); background-size: var(--cell-size) var(--cell-size); border: 1px solid #71809675; }
.panning, .panning :deep(*) { cursor: grab !important; }
.note { color: var(--ui-text-muted); font-size: .875rem; margin-top: 12px; }
@media (max-width: 600px) { .interactive-study { padding: 12px; } }
</style>
