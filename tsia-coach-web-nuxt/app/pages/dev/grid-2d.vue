<script setup lang="ts">
import RodBoard3D from '~/components/grid/RodBoard3D.vue'
import { cuisenaireFixture } from '~/components/grid/cuisenaireFixture'
import { canPlaceRod } from '~/components/grid/rodGeometry'
import type { Point } from '~/components/grid/gridPointer'
import type { RodDefinitionResponse, RodOrientation } from '#shared/types/rods'
import { placeDomainRod, readRodDefinition } from '~/components/grid/rodCatalog'

definePageMeta({ layout: false })
const fixture = reactive({ cols: 12, rows: 12, cellSize: 28, tiltDegrees: 25 })
const { data: catalog, error: catalogError } = await useFetch<RodDefinitionResponse[]>('/api/rods')
const rods = ref((catalog.value ?? []).map(readRodDefinition).map(definition => {
  const position = cuisenaireFixture.find(rod => rod.length === definition.length)!
  return placeDomainRod(definition, position.x, position.y === 0 ? 0 : position.y + 3)
}))
const selected = ref<number | null>(null)
const selectedRod = computed(() => rods.value.find(rod => rod.length === selected.value))
const status = ref('Drag a rod to move it. Arrow keys move a focused rod; Escape cancels a drag.')
function drop(length: number, point: Point) {
  const rod = rods.value.find(rod => rod.length === length)
  if (!rod || !canPlaceRod({ ...rod, ...point }, rods.value.filter(other => other !== rod), fixture.cols, fixture.rows)) return
  Object.assign(rod, point)
  status.value = `Length ${length} rod placed at column ${point.x}, row ${point.y}.`
}

function orient(orientation: RodOrientation) {
  const rod = selectedRod.value
  if (!rod) return
  const candidate = placeDomainRod(rod.definition, rod.x, rod.y, orientation)
  if (!canPlaceRod(candidate, rods.value.filter(other => other !== rod), fixture.cols, fixture.rows)) {
    status.value = 'Not enough room for that orientation. Choose another rod or orientation.'
    return
  }
  Object.assign(rod, candidate)
  status.value = orientation === 'tower'
    ? `Length ${rod.length} rod stands ${rod.length} units tall on one grid cell.`
    : `Length ${rod.length} rod lies ${orientation === 'horizontal' ? 'horizontally' : 'vertically'} on the grid.`
}

function rotate(length = selected.value, direction: 1 | -1 = 1) {
  const rod = rods.value.find(rod => rod.length === length)
  if (!rod) return
  selected.value = rod.length
  const rotation = (rod.rotation + direction * 90 + 360) % 360
  const candidate = placeDomainRod(rod.definition, rod.x, rod.y, rotation % 180 !== 0 ? 'vertical' : 'horizontal', rotation)
  if (!canPlaceRod(candidate, rods.value.filter(other => other !== rod), fixture.cols, fixture.rows)) {
    status.value = 'Not enough room to rotate here. The rod would overlap another rod or leave the grid.'
    return
  }
  Object.assign(rod, candidate)
  status.value = `Length ${rod.length} rod rotated ${direction === 1 ? 'clockwise' : 'counterclockwise'} to ${rotation}°.`
}
</script>

<template>
  <main>
    <p v-if="catalogError" role="alert">Could not load the domain rod catalog. Check that the API is running and NUXT_API_URL points to it.</p>
    <label>Cell size <input v-model.number="fixture.cellSize" type="range" min="20" max="40" step="1" aria-label="Cell size" > {{ fixture.cellSize }}px</label>
    <div class="rod-controls">
      <button type="button" :disabled="!selectedRod" :aria-pressed="!!selectedRod && !selectedRod.tower && !selectedRod.vertical" @click="orient('horizontal')">Horizontal</button>
      <button type="button" :disabled="!selectedRod" :aria-pressed="!!selectedRod && !selectedRod.tower && selectedRod.vertical" @click="orient('vertical')">Vertical</button>
      <button type="button" :disabled="!selectedRod" :aria-pressed="!!selectedRod?.tower" @click="orient('tower')">Tower</button>
      <button type="button" :disabled="selected === null" @click="rotate(selected, -1)">↶ Counterclockwise 90°</button>
      <button type="button" :disabled="selected === null" @click="rotate()">↷ Clockwise 90°</button>
      <p role="status">{{ status }}</p>
    </div>
    <RodBoard3D v-bind="fixture" :rods="rods" :selected="selected" @select="selected = $event" @rotate="rotate" @drop="drop" @rejected="status = 'That space is occupied or outside the grid. The rod stays in its previous position.'" />
  </main>
</template>

<style scoped>
main { max-width: 1040px; margin: 0 auto; padding: 32px 20px; }
.rod-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 16px; }
button { border: 1px solid #829eb4; border-radius: 6px; padding: 8px 14px; cursor: pointer; }
button:disabled { opacity: .5; cursor: default; }
button[aria-pressed="true"] { background: #22557d; color: white; }
button:focus-visible { outline: 3px solid #22557d; outline-offset: 3px; }
p { font-size: 14px; }
</style>
