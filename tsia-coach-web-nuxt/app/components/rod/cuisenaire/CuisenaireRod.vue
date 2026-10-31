<script setup lang="ts">
import { computed } from 'vue'
import {type RodProps, rodStyle} from "~/components/rod/rod.types.ts";


const props = withDefaults(defineProps<RodProps>(), {
  presentation: 'raised',
  selected: false,
  sign: 1,
})

const negative = computed(() => props.sign === -1)

// Both flat presentations sit on the board plane; only the unit-divided one
// also draws the unit cells the piece is made of.
const flat = computed(() => props.presentation !== 'raised')
const unitDivided = computed(() => props.presentation === 'flat-units')

// The footprint already encodes orientation: a horizontal v is v×1 and a
// vertical v is 1×v. Reading the divisions off it keeps them on the board
// lattice without positioning any cell in screen coordinates.
const columns = computed(() => Math.max(1, Math.round(props.dimensions.width)))
const rows = computed(() => Math.max(1, Math.round(props.dimensions.depth)))
const unitCount = computed(() => columns.value * rows.value)

const style = computed(() => ({
  // A flat piece has no extrusion to project, so its height resolves to zero
  // and the shared raised-piece lean becomes the identity for it.
  ...rodStyle(
    flat.value ? { ...props.dimensions, height: 0 } : props.dimensions,
    props.unitSize,
  ),
  '--unit-columns': String(columns.value),
  '--unit-rows': String(rows.value),
  '--fill': props.appearance.fill,
  '--ink': props.appearance.ink,
}))
</script>

<template>
  <div
    class="rod"
    :class="{ 'rod--flat': flat, 'rod--units': unitDivided, 'rod--selected': selected, 'rod--negative': negative }"
    :style="style"
    :data-rod-presentation="presentation"
    :data-rod-sign="negative ? 'negative' : 'positive'"
    :data-rod-label="label"
    :data-width-px="dimensions.width * unitSize"
  >
    <template v-if="!flat">
      <span class="face bottom" />
      <span class="face front" />
      <span class="face back" />
      <span class="face left" />
      <span class="face right" />
    </template>
    <!-- The one surface every presentation shares: hit target and measurement.
         It stays a single element, so a divided group is still one piece. -->
    <span
      :class="flat ? 'strip' : 'face top'"
      data-rod-surface
    >
      <!-- Decorative: the cells are drawn, not labelled, and the group total
           stays on the wrapper's accessible name. -->
      <span
        v-if="unitDivided"
        class="units"
        aria-hidden="true"
      >
        <span
          v-for="unit in unitCount"
          :key="unit"
          class="unit"
        /></span>
      <template v-else>{{ label }}</template>
    </span>
  </div>
</template>
<style scoped>
.rod {
  --w: 28px;
  --d: 28px;
  --h: 28px;
  --fill: white;
  --ink: #202020;
  --rod-label-offset: 0px;

  position: relative;
  width: var(--w);
  height: var(--d);
  transform-style: preserve-3d;
  top: var(--rod-label-offset, 0px);
  line-height: 1;
}

.face,
.strip {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  background: var(--fill);
  border: 1px solid rgb(0 0 0 / 30%);
  transform-origin: 0 0;
}

.bottom,
.top,
.strip {
  width: var(--w);
  height: var(--d);
}

.top,
.strip {
  display: grid;
  place-items: center;
  color: var(--ink);
}

.top {
  transform: translateZ(var(--h));
}

/* No translateZ at all: the strip is part of the board plane, not above it. */
.strip {
  transform: none;
}

/* One group, not four pieces: a perimeter stronger than the divisions inside. */
.rod--units .strip {
  border: 2px solid color-mix(in srgb, var(--ink) 80%, transparent);
}

/* The divisions fill the surface exactly, so every cell covers one board cell.
   Decorative only: the strip above remains the single interaction surface. */
.units {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(var(--unit-columns, 1), 1fr);
  grid-template-rows: repeat(var(--unit-rows, 1), 1fr);
  pointer-events: none;
}

/* An inset line per cell: it cannot collapse with its neighbour, so a four
   shows three internal boundaries rather than one merged block. The cells are
   drawn only — the count is read off them, not printed in them. */
.unit {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 55%, transparent);
}

.front,
.back {
  width: var(--w);
  height: var(--h);
}

.front {
  transform: translateY(var(--d)) rotateX(90deg);
  filter: brightness(0.85);
}

.back {
  transform: rotateX(90deg);
  filter: brightness(0.85);
}

.left,
.right {
  width: var(--d);
  height: var(--h);
}

.left {
  transform: rotateZ(90deg) rotateX(90deg);
  filter: brightness(0.7);
}

.right {
  transform: translateX(var(--w)) rotateZ(90deg) rotateX(90deg);
  filter: brightness(0.7);
}
</style>

<style scoped>
/* A negative rod keeps its colour and footprint but its cap is recessed: a
   flat rim around a hollow lit from the top left, so the upper-left inner
   walls fall into shadow and the lower-right walls catch light. Everything is
   painted on the existing surface, so hit testing, size and the selection
   ring are unchanged, and no extra face can take input or focus. */
.rod--negative [data-rod-surface] {
  --rim: max(2px, min(4px, calc(var(--d) * 0.14)));

  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--fill) 62%, black) 0%,
      color-mix(in srgb, var(--fill) 88%, black) 55%,
      var(--fill) 100%
    );
  box-shadow:
    inset 0 0 0 var(--rim) var(--fill),
    inset 0 0 0 calc(var(--rim) + 1px) color-mix(in srgb, var(--fill) 45%, black),
    inset calc(var(--rim) + 3px) calc(var(--rim) + 3px) 5px rgb(0 0 0 / 40%),
    inset calc(-1 * var(--rim) - 2px) calc(-1 * var(--rim) - 2px) 4px rgb(255 255 255 / 30%);
  font-weight: 700;
}

/* Paint on the actual cap, so raised rods, towers and flat pieces all use
   their own surface geometry. The ring never changes layout or hit testing. */
.rod--selected [data-rod-surface]::after {
  content: '';
  position: absolute;
  inset: 2px;
  border: 2px solid var(--ui-primary);
  box-shadow: 0 0 0 1px var(--mt-bg-elevated);
  pointer-events: none;
}
</style>
