<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import CuisenaireRod from '~/components/rod/cuisenaire/CuisenaireRod.vue'
import type { Point } from '~/components/grid/gridPointer'
import { useInertialBoardDrag } from '~/composables/useInertialBoardDrag'
import type { DragProps } from '~/components/rod/rod.types.ts'
import { arrayRodDimensions } from '../array/array-rod.types'
import { cuisenaireRodPalette } from '~/components/rod/rod.types.ts'
import type { SelectionIntent } from '../scene/scene-interaction.types'

const props = withDefaults(defineProps<DragProps>(), {
  snapToGrid: true,
  disabled: false,
  selected: false,
})

const emit = defineEmits<{
  select: [intent: SelectionIntent]
  settled: [position: Point]
  'move-preview': [position: Point]
  'move-end': []
}>()

const dimensions = computed(() =>
  props.dimensions ?? {
    width: props.value,
    depth: 1,
    height: 1,
  },
)

const visualParts = computed(() => {
  if (props.parts) {
    return props.parts.map(part => ({
      value: part.value,
      offset: part.offset,
      dimensions: arrayRodDimensions(
        part.value,
        part.orientation,
      ),
    }))
  }

  return [{
    value: props.value,
    offset: { x: 0, y: 0 },
    dimensions: dimensions.value,
  }]
})

const totalValue = computed(() =>
  visualParts.value.reduce((sum, part) => sum + part.value, 0),
)

const objectName = computed(() =>
  visualParts.value.length === 1
    ? `${totalValue.value}-rod`
    : `Train, value ${totalValue.value}, ${visualParts.value.length} parts`,
)

const accessibleLabel = computed(() =>
  `${objectName.value} at column ${props.x}, row ${props.y}. ` +
  (props.disabled
    ? 'Editing unavailable.'
    : `${props.selected ? 'Selected. ' : ''}Use arrow keys to move.`),
)

const element = ref<HTMLElement | null>(null)

const drag = useInertialBoardDrag({
  el: element,
  position: () => ({ x: props.x, y: props.y }),
  cellSize: () => props.cellSize,
  snapToGrid: () => props.snapToGrid,
  constrainPosition: props.constrainPosition,
  enabled: () => !props.disabled,
  onSettled: position => emit('settled', position),
  onStart: () => props.beginMove?.() ?? true,
  onPreview: position => emit('move-preview', position),
  onEnd: () => emit('move-end'),
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

function onSelectionPointerDown(event: PointerEvent): void {
  if (props.disabled || event.button !== 0 || !event.isPrimary) return

  const toggle = event.shiftKey || event.ctrlKey || event.metaKey

  emit('select', {
    mode: toggle ? 'toggle' : 'preserve',
  })

  if (toggle) {
    // Modifier selection must not turn into a drag.
    event.preventDefault()
    event.stopImmediatePropagation()
    element.value?.focus({ preventScroll: true })
  }
}

function onSelectionKeydown(event: KeyboardEvent): void {
  if (props.disabled) return
  if (event.key !== 'Enter' && event.key !== ' ') return

  event.preventDefault()
  if (event.repeat) return

  emit('select', {
    mode: event.key === ' ' ? 'toggle' : 'replace',
  })
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
      :aria-roledescription="visualParts.length > 1 ? 'movable train' : 'movable rod'"
      :aria-disabled="disabled"
      :aria-label="accessibleLabel"
      :style="{
        left: `${x * cellSize}px`,
        top: `${y * cellSize}px`,
        width: `${dimensions.width * cellSize}px`,
        height: `${dimensions.depth * cellSize}px`,
        translate: props.previewDelta
          ? `${props.previewDelta.x * cellSize}px ${props.previewDelta.y * cellSize}px`
          : '0px 0px',
      }"
      @pointerdown.capture="onSelectionPointerDown"
      @keydown.capture="onSelectionKeydown"
  >
    <div class="rod-visual">
      <div
          v-for="(part, index) in visualParts"
          :key="index"
          class="train-part"
          :data-train-part="index"
          :data-part-value="part.value"
          :style="{
            left: `${part.offset.x * cellSize}px`,
            top: `${part.offset.y * cellSize}px`,
          }"
          aria-hidden="true"
      >
        <CuisenaireRod
            :dimensions="part.dimensions"
            :unit-size="cellSize"
            :appearance="cuisenaireRodPalette[part.value]"
            :label="String(part.value)"
        />
      </div>
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
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;

  /* Raised faces shift slightly right; the base stays on the grid. */
  transform: matrix3d(
      1, 0, 0, 0,
      0, 1, 0, 0,
      0.1,-0.1, 1, 0,
      0, 0, 0, 1
  );
}

.train-part {
  position: absolute;
  transform-style: preserve-3d;
}
</style>
