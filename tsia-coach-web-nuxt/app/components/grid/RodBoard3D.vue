<script setup lang="ts">
import CssRod3D from './CssRod3D.vue'
import { canPlaceRod } from './rodGeometry'
import type { SceneRod } from './rodCatalog'
import type { Point } from './gridPointer'
import { rodPalette, type RodLength } from './rodPalette'
import GridSurface from "~/components/grid/surface/GridSurface.vue";
import type {GridConfig, GridView} from "~/components/grid/surface/grid.types.ts";

const props = defineProps<{
  cols: number,
  rows: number,
  cellSize:number,
  tiltDegrees: number,
  rods: SceneRod[],
  selected: number | null }>()
const emit = defineEmits<{ select: [length: RodLength], rotate: [length: RodLength, direction: 1 | -1], drop: [length: RodLength, point: Point], rejected: [] }>()
function canDrop(rod: SceneRod, point: Point) {
  return canPlaceRod({ ...rod, ...point }, props.rods.filter(other => other.length !== rod.length), props.cols, props.rows)
}

const gridConfig = computed<GridConfig>(() => ({
  columns: props.cols,
  rows: props.rows,
  cellSize: props.cellSize,
}))

const gridView= computed<GridView>(() => ({
  tiltDegrees: props.tiltDegrees,

}))
</script>

<template>
  <section aria-label="Rod board">
    <GridSurface
        :config="gridConfig"
        :view="gridView"
    >
      <CssRod3D
          v-for="rod in rods"
          :key="rod.length"
          :rod="rod"
          :cell-size="cellSize"
          :selected="selected === rod.length"
          :can-drop="point => canDrop(rod, point)"
          @select="emit('select', rod.length)"
          @rotate="emit('rotate', rod.length, $event)"
          @drop="emit('drop', rod.length, $event)"
          @rejected="emit('rejected')"
      />
    </GridSurface>
    <div class="picker" aria-label="Choose a rod">
      <button
v-for="rod in rods" :key="rod.length" type="button" :aria-label="`Select ${rodPalette[rod.length].name.toLowerCase()} rod`"
        :aria-pressed="selected === rod.length" :style="{ background: rodPalette[rod.length].fill, color: rodPalette[rod.length].ink }"
        @click="emit('select', rod.length)">{{ rod.length }}</button>
    </div>
  </section>
</template>

<style scoped>
.picker { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px 0; }
button { border: 1px solid #829eb4; border-radius: 6px; padding: 6px 12px; cursor: pointer; }
button[aria-pressed="true"], button:focus-visible { outline: 3px solid #829eb4; outline-offset: 2px; }
</style>
