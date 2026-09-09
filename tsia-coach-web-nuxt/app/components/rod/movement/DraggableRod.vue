<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import CuisenaireRod from '~/components/rod/cuisenaire/CuisenaireRod.vue'
import type { Point } from '~/components/grid/gridPointer'
import { useInertialBoardDrag } from '~/composables/useInertialBoardDrag'
import {cusisenaireRodPalette, type DragProps} from "~/components/rod/rod.types.ts";

const props = withDefaults(defineProps<DragProps>(), {
  snapToGrid: true,
  disabled: false,
  selected: false,
})

const emit = defineEmits<{
  settled: [position: Point]
  select: []
}>()

const dimensions = computed(() =>
        props.dimensions ?? {
          width: props.value,
          depth: 1,
          height: 1,
        },
)

const element = ref<HTMLElement | null>(null)

const drag = useInertialBoardDrag({
  el: element,
  position: () => ({ x: props.x, y: props.y }),
  cellSize: () => props.cellSize,
  snapToGrid: () => props.snapToGrid,
  enabled: () => !props.disabled,
  onSettled: position => emit('settled', position),
})

watch(
    () => [
      dimensions.value.width,
      dimensions.value.depth,
      dimensions.value.height,
    ],
    () => drag.cancel(),
    { flush: 'sync' },
)

function requestSelection(): void {
  if (!props.disabled) emit('select')
}

defineExpose({
  cancelDrag: drag.cancel,
})
</script>

<template>
  <div
      ref="element"
      class="draggable-rod"
      :class="{ 'draggable-rod--selected': selected }"
      :data-piece-id="id"
      :tabindex="disabled ? -1 : 0"
      role="button"
      aria-roledescription="movable rod"
      :aria-disabled="disabled"
      :aria-label="disabled
    ? `${value}-rod. Portrait preview; editing unavailable.`
    : `${value}-rod at column ${x}, row ${y}. ${
        selected ? 'Selected. ' : ''
      }Use arrow keys to move.`"
      :style="{
    left: `${x * cellSize}px`,
    top: `${y * cellSize}px`,
    width: `${dimensions.width * cellSize}px`,
    height: `${dimensions.depth * cellSize}px`,
  }"
      @pointerdown.capture="requestSelection"
      @focus="requestSelection"
      @keydown.enter.prevent="requestSelection"
      @keydown.space.prevent="requestSelection"
  >
    <div class="rod-visual">
      <CuisenaireRod
          :dimensions="dimensions"
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

.draggable-rod--selected {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.draggable-rod:focus-visible {
  outline: 3px dashed var(--ui-primary);
  outline-offset: 5px;
}

.draggable-rod[aria-disabled="true"] {
  cursor: default;
  touch-action: auto;
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