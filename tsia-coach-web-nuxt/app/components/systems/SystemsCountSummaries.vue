<script setup lang="ts">
import { computed } from 'vue'
import type { LowerDisplay } from '~/composables/useSystemsCountActivity'
import type { CountEvaluation } from './systems.count-evaluate'
import { checkEquation } from './systems.candidates'
import { areaOutcome, substitutionLines } from './systems.count-feedback'
import { countLayout } from './systems.count-layout'
import { equationText } from './systems.geometry'
import type { SystemsBoardConfig } from './systems.schema'

/** The Area panels beside each band: addends, totals and the target comparison. */
const props = defineProps<{
  config: SystemsBoardConfig
  evaluation: CountEvaluation
  /** Which counts Equation 2 shows, and how to label them. */
  display: LowerDisplay
  /** The open conversion's workspace summary, if any. */
  conversion?: string
  cellSize: number
  paddingY: number
  scrollTop: number
}>()

const summaries = computed(() => {
  const layout = countLayout(props.config)
  const evaluation = props.evaluation
  return props.config.system.equations.map((equation, index) => {
    const band = index === 0 ? layout.upper : layout.lower
    const style = {
      top: `${1 + props.paddingY + band.y * props.cellSize - props.scrollTop}px`,
      height: `${band.depth * props.cellSize}px`,
    }
    const base = { id: equation.id, index, style, title: index === 0 ? 'Equation 1' : 'Equation 2 check', equation: equationText(equation) }
    if (!evaluation.valid) return { ...base, lines: [] as string[], status: evaluation.reason, state: 'neutral' as const }
    const display = props.display
    if (index === 1 && display.kind !== 'current') {
      if (!display.counts || !display.check) {
        return { ...base, lines: [] as string[], status: 'Waiting for whole x and y rods in Equation 1.', state: 'neutral' as const }
      }
      // A retained or confirmed check: truthfully labelled, never a new candidate.
      const lines = [display.label, ...substitutionLines(equation.coefficients, display.counts, display.check)]
      const holds = display.check.satisfied
      return {
        ...base,
        lines,
        status: holds ? '✓ Holds' : `✕ Target ${display.check.target} · ${areaOutcome(display.check)}`,
        state: display.kind === 'previous' ? 'neutral' as const : holds ? 'correct' as const : 'incorrect' as const,
      }
    }
    if (index === 0 && props.conversion && display.counts) {
      const check = checkEquation(equation, display.counts)
      return {
        ...base,
        lines: ['Confirmed candidate', ...substitutionLines(equation.coefficients, display.counts, check), props.conversion],
        status: '✓ Holds: confirmed',
        state: 'correct' as const,
      }
    }
    const check = index === 0 ? evaluation.upper : evaluation.lower
    if (!check) {
      return { ...base, lines: [] as string[], status: 'Waiting for whole x and y rods in Equation 1.', state: 'neutral' as const }
    }
    const lines = substitutionLines(equation.coefficients, evaluation.counts, check, index === 0 ? evaluation.upper.unassigned : 0)
    let status: string
    let state: 'neutral' | 'correct' | 'incorrect'
    if (index === 0) {
      state = check.satisfied ? 'correct' : 'neutral'
      status = check.satisfied
        ? '✓ Holds: a candidate'
        : evaluation.upper.unassigned
          ? `${evaluation.upper.unassigned} unassigned: not whole x or y rods`
          : `Target ${check.target} · ${areaOutcome(check)}`
    } else if (!evaluation.candidate) {
      state = 'neutral'
      status = `Target ${check.target} · follows your counts`
    } else {
      state = check.satisfied ? 'correct' : 'incorrect'
      status = check.satisfied ? '✓ Holds: common solution' : `✕ Target ${check.target} · ${areaOutcome(check)}`
    }
    return { ...base, lines, status, state }
  })
})
</script>

<template>
  <div
    class="count-summaries"
    :style="{ '--summary-cell-size': `${cellSize}px` }"
    aria-live="polite"
    aria-atomic="true"
  >
    <section
      v-for="summary in summaries"
      :key="summary.id"
      class="count-summary"
      :class="`count-summary--${summary.state}`"
      :style="summary.style"
      :aria-label="`${summary.title} area`"
      :data-systems-count-summary="summary.index + 1"
      :data-correctness="summary.state"
    >
      <strong>{{ summary.title }}</strong>
      <span class="count-summary-equation">{{ summary.equation }}</span>
      <span class="count-summary-heading">Area</span>
      <span
        v-for="line in summary.lines"
        :key="line"
        class="count-summary-line"
      >{{ line }}</span>
      <span class="count-summary-status">{{ summary.status }}</span>
    </section>
  </div>
</template>

<style scoped>
.count-summaries {
  position: absolute;
  inset: 0;
  overflow: hidden;
  color: var(--mt-text);
}
.count-summary {
  position: absolute;
  inset-inline: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  box-sizing: border-box;
  min-height: 0;
  padding: 4px 6px;
  border-inline-start: 2px solid var(--mt-border-accent);
  background: color-mix(in srgb, var(--mt-surface-2, #888) 35%, transparent);
  font-size: clamp(9px, calc(var(--summary-cell-size) * 0.55), 14px);
  line-height: 1.2;
}
.count-summary-equation { font-weight: 600; }
.count-summary-heading { margin-top: 2px; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.04em; }
.count-summary-line { font-variant-numeric: tabular-nums; }
.count-summary-status { margin-top: 2px; font-weight: 700; }
.count-summary--correct { --state: var(--ui-success, #16a34a); }
.count-summary--incorrect { --state: var(--ui-error, #dc2626); }
.count-summary--correct, .count-summary--incorrect {
  border-color: var(--state);
  box-shadow: inset 0 0 0 1px var(--state);
}
.count-summary--correct .count-summary-status, .count-summary--incorrect .count-summary-status { color: var(--state); }
</style>
