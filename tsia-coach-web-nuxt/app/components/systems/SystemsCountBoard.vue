<script setup lang="ts">
import { computed } from 'vue'
import GridSurface from '~/components/grid/surface/GridSurface.vue'
import CuisenaireRod from '~/components/rod/cuisenaire/CuisenaireRod.vue'
import { arrayRodDimensions } from '~/components/rod/array/array-rod.types'
import { cuisenaireRodPalette, type CuisenaireRodValue } from '~/components/rod/rod.types'
import type { RodTrain } from '~/components/rod/scene/rod.scene.types'
import { trainFootprints } from '~/components/rod/scene/part-footprint'
import type { CountEvaluation } from './systems.count-evaluate'
import { countLayout } from './systems.count-layout'
import type { CountPlanDetail } from './systems.count-operations'
import type { SystemsBoardConfig } from './systems.schema'

/**
 * The rod-count board surface. Bands, labels, the derived Equation 2 rods,
 * unassigned-material marks and preview ghosts are all decoration: no input,
 * never scene material. Learner rods arrive through the pieces slot.
 */
const props = withDefaults(defineProps<{
  config: SystemsBoardConfig
  cellSize: number
  evaluation: CountEvaluation
  /** Equation 2's rods for the current counts. */
  derived: readonly RodTrain[]
  preview?: CountPlanDetail | null
  viewportPadding?: string
}>(), {
  preview: null,
  viewportPadding: '16px',
})

const layout = computed(() => countLayout(props.config))
const gridConfig = computed(() => ({ columns: layout.value.columns, rows: layout.value.rows, cellSize: props.cellSize }))

const box = (x: number, y: number, width: number, depth: number) => ({
  left: `${x * props.cellSize}px`,
  top: `${y * props.cellSize}px`,
  width: `${width * props.cellSize}px`,
  height: `${depth * props.cellSize}px`,
})

const swatch = (value: number) => cuisenaireRodPalette[value as CuisenaireRodValue]?.fill ?? 'var(--mt-border)'

const bands = computed(() => props.config.system.equations.map((equation, index) => {
  const band = index === 0 ? layout.value.upper : layout.value.lower
  return {
    index,
    band,
    x: equation.coefficients.x,
    y: equation.coefficients.y,
    label: `Equation ${index + 1}`,
  }
}))

const unassigned = computed(() => props.evaluation.valid ? props.evaluation.material.unassigned : [])
const lowerKey = computed(() => props.evaluation.valid ? `${props.evaluation.counts.xCount}-${props.evaluation.counts.yCount}` : 'none')
const lowerSatisfied = computed(() => props.evaluation.valid && props.evaluation.lower?.satisfied === true)
const upperSatisfied = computed(() => props.evaluation.valid && props.evaluation.upper.satisfied)
const waitingText = computed(() => {
  if (!props.evaluation.valid) return ''
  if (props.derived.length) return ''
  return 'Equation 2 is rebuilt here from your x and y counts once Equation 1 uses only whole, upright x and y rods.'
})

const ghostParts = (trains: readonly RodTrain[], kind: 'added' | 'moved') =>
  trains.flatMap((train, index) => trainFootprints(train).map((footprint, part) => ({
    key: `${kind}-${index}-${part}`, kind, footprint, value: train.parts[part]!.value,
  })))
const ghosts = computed(() => props.preview
  ? [...ghostParts(props.preview.moved, 'moved'), ...ghostParts(props.preview.added, 'added')]
  : [])
</script>

<template>
  <GridSurface
    :config="gridConfig"
    :view="{ tiltDegrees: 0 }"
    :show-grid="true"
    :viewport-padding="viewportPadding"
    viewport-alignment="start"
  >
    <template
      v-for="item in bands"
      :key="item.index"
    >
      <div
        class="count-band"
        :class="{ 'count-band--derived': item.index === 1, 'count-band--holds': item.index === 0 ? upperSatisfied : lowerSatisfied }"
        :data-count-band="item.index + 1"
        :data-systems-region="item.index === 0 ? layout.upper.id : undefined"
        :style="box(item.band.x, item.band.y, item.band.width, item.band.depth)"
        aria-hidden="true"
      />
      <div
        class="count-gutter"
        :style="box(0, item.band.y, layout.upper.x, item.band.depth)"
        aria-hidden="true"
      >
        <span class="count-gutter-title">E{{ item.index + 1 }}</span>
        <span
          class="count-chip"
          :style="{ background: swatch(item.x) }"
        >x</span>
        <span class="count-chip-value">{{ item.x }}</span>
        <span
          class="count-chip"
          :style="{ background: swatch(item.y) }"
        >y</span>
        <span class="count-chip-value">{{ item.y }}</span>
      </div>
    </template>

    <p
      v-if="waitingText"
      class="count-waiting"
      :style="box(layout.lower.x, layout.lower.y, layout.lower.width, layout.lower.depth)"
      aria-hidden="true"
    >
      {{ waitingText }}
    </p>

    <div
      :key="lowerKey"
      class="count-derived"
      aria-hidden="true"
      inert
    >
      <div
        v-for="train in derived"
        :key="train.id"
        class="count-derived-rod"
        :data-systems-derived="train.id"
        :data-value="train.parts[0]!.value"
        :style="box(train.anchor.x, train.anchor.y, 0, 0)"
      >
        <CuisenaireRod
          :dimensions="arrayRodDimensions(train.parts[0]!.value, 'vertical')"
          :unit-size="cellSize"
          :appearance="cuisenaireRodPalette[train.parts[0]!.value]"
          :label="String(train.parts[0]!.value)"
          presentation="flat"
        />
      </div>
    </div>

    <slot
      name="pieces"
      :cell-size="cellSize"
    />

    <div
      v-for="(part, index) in unassigned"
      :key="`unassigned-${index}`"
      class="count-unassigned"
      data-systems-unassigned
      :title="part.reason === 'orientation' ? 'Lying rod: stand it upright to count it' : 'Unassigned material'"
      :style="box(part.footprint.x, part.footprint.y, part.footprint.width, part.footprint.depth)"
      aria-hidden="true"
    />

    <div
      v-for="ghost in ghosts"
      :key="ghost.key"
      class="count-ghost"
      :class="`count-ghost--${ghost.kind}`"
      :data-systems-ghost="ghost.kind"
      :style="{ ...box(ghost.footprint.x, ghost.footprint.y, ghost.footprint.width, ghost.footprint.depth), '--ghost-color': swatch(ghost.value) }"
      aria-hidden="true"
    >
      <span v-if="ghost.kind === 'added'">+</span>
    </div>
  </GridSurface>
</template>

<style scoped>
.count-band {
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  border: 2px solid var(--mt-border-accent);
  background: color-mix(in srgb, var(--mt-bg-elevated) 70%, transparent);
}
.count-band--derived { border-style: dashed; }
.count-band--holds { border-color: var(--ui-success, #16a34a); box-shadow: 0 0 0 1px var(--ui-success, #16a34a); }

.count-gutter {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
  box-sizing: border-box;
  padding: 2px;
  pointer-events: none;
  color: var(--mt-text);
  font-size: max(9px, calc(var(--cell-size) * 0.45));
  line-height: 1.1;
}
.count-gutter-title { font-weight: 700; }
.count-chip {
  display: grid;
  place-items: center;
  width: calc(var(--cell-size) * 1.2);
  height: calc(var(--cell-size) * 0.9);
  border-radius: 3px;
  color: #141922;
  font-weight: 700;
}
.count-chip-value { font-variant-numeric: tabular-nums; }

.count-waiting {
  position: absolute;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  margin: 0;
  padding: 8px;
  pointer-events: none;
  color: var(--mt-text-muted, var(--mt-text));
  font-size: max(11px, calc(var(--cell-size) * 0.5));
  text-align: center;
}

.count-derived { position: absolute; inset: 0; pointer-events: none; }
.count-derived-rod {
  position: absolute;
  opacity: 0.72;
  user-select: none;
  animation: count-appear 220ms ease-out;
}
.count-derived-rod :deep(.rod) { outline: 1px dashed var(--mt-text); outline-offset: -2px; }

.count-unassigned {
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  border: 2px solid #6b7280;
  background: repeating-linear-gradient(45deg, rgb(107 114 128 / 0.75) 0 4px, rgb(107 114 128 / 0.35) 4px 8px);
  z-index: 2;
}

.count-ghost {
  position: absolute;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  pointer-events: none;
  z-index: 3;
  color: #141922;
  font-weight: 800;
  animation: count-appear 220ms ease-out;
}
.count-ghost--added {
  border: 2px dashed var(--ui-primary);
  background: color-mix(in srgb, var(--ghost-color) 55%, transparent);
}
.count-ghost--moved {
  border: 2px dotted var(--mt-text);
  background: color-mix(in srgb, var(--ghost-color) 20%, transparent);
}

@keyframes count-appear {
  from { opacity: 0; transform: translateY(-4px); }
}

@media (prefers-reduced-motion: reduce) {
  .count-derived-rod, .count-ghost { animation: none; }
}
</style>
