<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import CuisenaireRod from '~/components/rod/cuisenaire/CuisenaireRod.vue'
import raisedPiece from '~/components/grid/raised-piece.module.css'
import { raisedPieceStyle } from '~/components/grid/raised-piece'
import type { Point } from '~/components/grid/gridPointer'
import { useInertialBoardDrag } from '~/composables/useInertialBoardDrag'
import type { DragProps } from '~/components/rod/rod.types.ts'
import { arrayRodDimensions } from '../array/array-rod.types'
import { cuisenaireRodPalette } from '~/components/rod/rod.types.ts'
import type { SelectionIntent } from '../scene/scene-interaction.types'
import {
  formatAddend,
  formatSigned,
  partSign,
  partSignedValue,
  trainMagnitude,
  trainSignKind,
  trainSignedTotal,
} from '../scene/rod-arithmetic'

const props = withDefaults(defineProps<DragProps>(), {
  snapToGrid: true,
  disabled: false,
  selected: false,
  presentation: 'raised',
  layerInert: false,
})

// An inert piece is not editable here, whatever the board's own state.
const inactive = computed(() => props.disabled || props.layerInert)

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

// Group outlines span the constituent rods without changing the train footprint.
const addendGroups = computed(() => [0, 1].flatMap(group => {
  const parts = props.parts?.filter(part => part.addendGroup === group) ?? []
  if (!parts.length) return []
  const x = Math.min(...parts.map(part => part.offset.x))
  const y = Math.min(...parts.map(part => part.offset.y))
  const right = Math.max(...parts.map(part => part.offset.x + arrayRodDimensions(part.value, part.orientation).width))
  const bottom = Math.max(...parts.map(part => part.offset.y + arrayRodDimensions(part.value, part.orientation).depth))
  return [{ group, x, y, width: right - x, depth: bottom - y, total: trainSignedTotal({ parts }) }]
}))

const visualParts = computed(() => {
  if (props.parts) {
    return props.parts.map(part => ({
      value: part.value,
      sign: partSign(part),
      offset: part.offset,
      dimensions: arrayRodDimensions(
        part.value,
        part.orientation,
      ),
    }))
  }

  return [{
    value: props.value,
    sign: 1 as const,
    offset: { x: 0, y: 0 },
    dimensions: dimensions.value,
  }]
})

// What is drawn. Normally the parts themselves; during a zero-pair preview the
// larger rod is drawn as ghost pieces over the same cells. The semantic object
// (its name, value and input) still comes from visualParts.
const drawnParts = computed(() => {
  const preview = props.preview
  if (preview?.role === 'decomposed') {
    return preview.pieces.map(piece => ({
      value: piece.value,
      sign: piece.sign,
      offset: piece.offset,
      dimensions: arrayRodDimensions(piece.value, piece.orientation),
      previewRole: piece.role as 'remainder' | 'cancelling' | undefined,
    }))
  }
  const role = preview?.role === 'zero-pair' ? 'cancelling' as const : undefined
  return visualParts.value.map(part => ({ ...part, previewRole: role }))
})

const train = computed(() => ({ parts: visualParts.value }))
const totalValue = computed(() => trainSignedTotal(train.value))
const signKind = computed(() => trainSignKind(train.value))

// Positive material keeps its established wording. Signed material states the
// arithmetic total and the physical length separately, because they differ,
// and a zero total is still a train, never an empty object.
const trainSummary = computed(() =>
  signKind.value === 'positive'
    ? `Train, value ${totalValue.value}`
    : `${signKind.value === 'mixed' ? 'Mixed-sign train' : 'Train'}, signed total ${totalValue.value}, ` +
      `physical length ${trainMagnitude(train.value)}`,
)

// A unit-divided piece shows its ones but is still one group, so the wrapper
// carries the whole description and every cell inside it stays decorative.
const objectName = computed(() => {
  if (addendGroups.value.length === 2) {
    return `${trainSummary.value}, addends ${addendGroups.value.map(group => formatAddend(group.total)).join(' + ')}`
  }
  const parts = visualParts.value.length

  if (signKind.value !== 'positive') {
    return parts === 1
      ? `Negative ${visualParts.value[0]!.value} rod`
      : `${trainSummary.value}, ${parts} parts`
  }

  if (props.presentation === 'flat-units') {
    return parts === 1
      ? `Group of ${totalValue.value} unit squares`
      : `Train, value ${totalValue.value}, ${parts} groups of unit squares`
  }

  return parts === 1
    ? `${totalValue.value}-rod`
    : `Train, value ${totalValue.value}, ${parts} parts`
})

const accessibleLabel = computed(() =>
  `${objectName.value} at column ${props.x}, row ${props.y}. ` +
  (props.layerInert
    ? 'On the other layer. Switch layer to edit it.'
    : props.disabled
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
  enabled: () => !inactive.value,
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
  if (inactive.value || event.button !== 0 || !event.isPrimary) return

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
  if (inactive.value) return
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
      :class="{ 'draggable-rod--selected': selected, 'draggable-rod--inert': layerInert }"
      :data-piece-id="id"
      :data-presentation="presentation"
      :data-layer-inert="layerInert ? 'true' : undefined"
      :tabindex="inactive ? -1 : 0"
      role="button"
      :aria-roledescription="visualParts.length > 1 ? 'movable train' : 'movable rod'"
      :aria-disabled="inactive"
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
    <div class="rod-visual" :class="raisedPiece.visual" :style="raisedPieceStyle">
      <div
        v-for="group in addendGroups"
        :key="`addend-${group.group}`"
        :data-addend-group="group.group"
        :data-addend-value="group.total"
        aria-hidden="true"
        :style="{
          position: 'absolute', pointerEvents: 'none', zIndex: 2,
          transform: `translateZ(${presentation === 'raised' ? cellSize + 1 : 1}px)`,
          left: `${group.x * cellSize + 2}px`, top: `${group.y * cellSize + 2}px`,
          width: `${group.width * cellSize - 4}px`, height: `${group.depth * cellSize - 4}px`,
          border: '2px solid var(--ui-primary)', borderRadius: '4px',
        }"
      />
      <div
          v-for="(part, index) in drawnParts"
          :key="`${preview?.role ?? 'part'}-${index}`"
          class="train-part"
          :class="part.previewRole && `train-part--${part.previewRole}`"
          :data-train-part="preview?.role === 'decomposed' ? undefined : index"
          :data-preview-role="part.previewRole"
          :data-part-value="part.value"
          :data-part-sign="part.sign"
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
            :label="formatSigned(partSignedValue(part))"
            :presentation="presentation"
            :selected="selected"
            :sign="part.sign"
        />
        <!-- Decorative boundary for a preview: hatched and dashed for the zero
             pair, solid for what remains, so colour is never the only cue. -->
        <span
            v-if="part.previewRole"
            class="preview-mark"
            :class="`preview-mark--${part.previewRole}`"
            :style="{
              width: `${part.dimensions.width * cellSize}px`,
              height: `${part.dimensions.depth * cellSize}px`,
              transform: `translateZ(${presentation === 'raised' ? part.dimensions.height * cellSize + 2 : 2}px)`,
            }"
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

/* Visible and in place, but transparent to input, so a click reaches the layer
   being edited — or the board — instead of stopping here. */
.draggable-rod--inert {
  pointer-events: none;
}

.train-part {
  position: absolute;
  transform-style: preserve-3d;
}

.preview-mark {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  pointer-events: none;
  border-radius: 3px;
}

.preview-mark--cancelling {
  border: 3px dashed var(--ui-warning, #d97706);
  background: repeating-linear-gradient(
    45deg,
    rgb(255 255 255 / 0%) 0 5px,
    color-mix(in srgb, var(--ui-warning, #d97706) 35%, transparent) 5px 8px
  );
}

.preview-mark--remainder {
  border: 3px solid var(--ui-success, #16a34a);
}
</style>
