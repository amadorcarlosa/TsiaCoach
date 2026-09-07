<script setup lang="ts">
import { ref } from 'vue'
import CuisenaireRod from './CuisenaireRod.vue'
import {
  type CuisenaireRodValue,
  cusisenaireRodPalette,
} from './rod.types'
import { useInertialBoardDrag } from '~/composables/useInertialBoardDrag'
import type { Point } from '~/components/grid/gridPointer'

const props = withDefaults(defineProps<{
  id: string
  value: CuisenaireRodValue
  x: number
  y: number
  cellSize: number
  snapToGrid?: boolean
}>(), {
  snapToGrid: true,
})

const emit = defineEmits<{
  settled: [position: Point]
}>()

const element = ref<HTMLElement | null>(null)

useInertialBoardDrag({
  el: element,
  position: () => ({ x: props.x, y: props.y }),
  cellSize: () => props.cellSize,
  snapToGrid: () => props.snapToGrid,
  onSettled: position => emit('settled', position),
})
</script>

<template>
  <div
      ref="element"
      class="draggable-rod"
      :data-piece-id="id"
      tabindex="0"
      role="button"
      aria-roledescription="movable rod"
      :aria-label="`${value}-rod at column ${x}, row ${y}. Use arrow keys to move.`"
      :style="{
      left: `${x * cellSize}px`,
      top: `${y * cellSize}px`,
    }"
  >
    <div class="rod-visual">
      <CuisenaireRod
          :dimensions="{ width: value, depth: 1, height: 1 }"
          :unit-size="cellSize"
          :appearance="cusisenaireRodPalette[value]"
          :label="String(value)"
      />
    </div>
  </div>
</template>

<style scoped>
.draggable-rod {
  position: absolute;
  transform-style: preserve-3d;
  touch-action: none;
  user-select: none;
  cursor: grab;
}

.draggable-rod:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 3px;
}
.rod-visual {
  transform-style: preserve-3d;

  /* Raised faces shift slightly right; the base stays on the grid. */
  transform: matrix3d(
      1, 0, 0, 0,
      0, 1, 0, 0,
      0.1,-0.1, 1, 0,
      0, 0, 0, 1
  );
}
</style>