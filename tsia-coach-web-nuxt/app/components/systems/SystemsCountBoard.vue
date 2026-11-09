<script setup lang="ts">
import { computed } from 'vue'
import GridSurface from '~/components/grid/surface/GridSurface.vue'
import CuisenaireRod from '~/components/rod/cuisenaire/CuisenaireRod.vue'
import { arrayRodDimensions } from '~/components/rod/array/array-rod.types'
import { cuisenaireRodPalette, type CuisenaireRodValue } from '~/components/rod/rod.types'
import type { Rectangle, RodTrain } from '~/components/rod/scene/rod.scene.types'
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
  /** Says which counts Equation 2 shows when they are not the current ones. */
  lowerLabel?: string
  /** The open conversion's material, outlined with its area. */
  workspace?: (Rectangle & { label: string }) | null
  /** Proposed group boundaries over the workspace rectangle. */
  partitions?: readonly Rectangle[]
  /** Conversion interprets its selected sources from the confirmed baseline. */
  converting?: boolean
}>(), {
  preview: null,
  viewportPadding: '16px',
  lowerLabel: '',
  workspace: null,
  partitions: () => [],
  converting: false,
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

const unassigned = computed(() => !props.converting && props.evaluation.valid ? props.evaluation.material.unassigned : [])
const lowerKey = computed(() => props.evaluation.valid ? `${props.evaluation.counts.xCount}-${props.evaluation.counts.yCount}` : 'none')
const lowerSatisfied = computed(() => props.evaluation.valid && props.evaluation.lower?.satisfied === true)
const upperSatisfied = computed(() => props.converting || (props.evaluation.valid && props.evaluation.upper.satisfied))
const waitingText = computed(() => {
  if (!props.evaluation.valid) return ''
  if (props.derived.length) return ''
  return 'Equation 2 is rebuilt here from your x and y counts once Equation 1 uses only whole, upright x and y rods.'
})

/**
 * Where the x rods end and the y rods begin, as a column edge, in each band.
 * Equation 1 shows it only while every x rod stands left of every y rod;
 * Equation 2's derived rods always stand that way.
 */
const divider = computed(() => {
  if (!props.evaluation.valid) return null
  const units = props.evaluation.material.units.filter(unit => unit.footprint.y === layout.value.upper.y)
  const xs = units.filter(unit => unit.variable === 'x')
  const ys = units.filter(unit => unit.variable === 'y')
  const upper = xs.length && ys.length && xs.length + ys.length === props.evaluation.material.units.length
    ? Math.max(...xs.map(unit => unit.footprint.x + unit.footprint.width))
    : null
  const separated = upper !== null && ys.every(unit => unit.footprint.x >= upper)
  const derivedX = props.derived.filter(train => train.id.startsWith('derived-x'))
  const derivedY = props.derived.filter(train => train.id.startsWith('derived-y'))
  const lower = derivedX.length && derivedY.length ? Math.max(...derivedX.map(train => train.anchor.x)) + 1 : null
  const { upper: top, lower: bottom } = layout.value
  const segments: { key: string; x: number; y: number; depth: number }[] = []
  if (separated && lower === upper) {
    segments.push({ key: 'both', x: upper, y: top.y, depth: bottom.y + bottom.depth - top.y })
  } else {
    if (separated) segments.push({ key: 'upper', x: upper, y: top.y, depth: top.depth })
    if (lower !== null) segments.push({ key: 'lower', x: lower, y: bottom.y, depth: bottom.depth })
  }
  return segments
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

    <p
      v-if="lowerLabel && derived.length"
      class="count-lower-label"
      data-systems-lower-label
      :style="box(layout.lower.x, layout.lower.y, layout.lower.width, 1)"
    >
      {{ lowerLabel }}
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
      v-if="workspace"
      class="count-workspace"
      data-systems-conversion-area
      :style="box(workspace.x, workspace.y, workspace.width, workspace.depth)"
      aria-hidden="true"
    >
      <span class="count-workspace-label">{{ workspace.label }}</span>
    </div>

    <div
      v-for="segment in divider ?? []"
      :key="`divider-${segment.key}`"
      class="count-divider"
      :data-systems-divider="segment.key"
      :data-column="segment.x"
      :style="box(segment.x, segment.y, 0, segment.depth)"
      aria-hidden="true"
    >
      <span class="count-divider-label count-divider-label--x">x</span>
      <span class="count-divider-label count-divider-label--y">y</span>
    </div>

    <div
      v-for="(band, index) in partitions"
      :key="`partition-${index}`"
      class="count-partition"
      data-systems-partition
      :style="box(band.x, band.y, band.width, band.depth)"
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
.count-lower-label {
  position: absolute;
  z-index: 2;
  box-sizing: border-box;
  margin: 0;
  padding-inline: 4px;
  overflow: hidden;
  pointer-events: none;
  color: var(--mt-text);
  font-size: max(10px, calc(var(--cell-size) * 0.5));
  font-weight: 700;
  line-height: var(--cell-size);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.count-workspace {
  position: absolute;
  z-index: 3;
  margin: -3px;
  padding: 0;
  pointer-events: none;
  border: 3px dashed var(--ui-primary);
  border-radius: 4px;
  box-sizing: content-box;
}
.count-divider {
  position: absolute;
  z-index: 3;
  margin-left: -1.5px;
  width: 3px !important;
  pointer-events: none;
  background: var(--count-divider, #e5484d);
  border-radius: 2px;
}
.count-divider-label {
  position: absolute;
  top: -16px;
  padding: 0 3px;
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
  color: #fff;
  background: var(--count-divider, #e5484d);
  border-radius: 3px;
}
.count-divider-label--x { right: 5px; }
.count-divider-label--y { left: 5px; }
.count-partition {
  position: absolute;
  z-index: 3;
  box-sizing: border-box;
  pointer-events: none;
  border: 2px dashed var(--mt-text);
  border-radius: 2px;
}
.count-workspace-label {
  position: absolute;
  bottom: 100%;
  right: 0;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--ui-primary);
  color: var(--ui-bg, #fff);
  font-size: max(10px, calc(var(--cell-size) * 0.45));
  font-weight: 700;
  white-space: nowrap;
}
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
