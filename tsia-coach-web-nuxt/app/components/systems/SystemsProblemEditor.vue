<script setup lang="ts">
import { ref, watch } from 'vue'
import { systemsBoardConfigSchema, systemsLimits, type SystemsBoardConfig } from './systems.schema'

const props = defineProps<{ config: SystemsBoardConfig; disabled: boolean }>()
const emit = defineEmits<{ apply: [config: SystemsBoardConfig] }>()
const equations = ref(props.config.system.equations.map(equation => ({
  id: equation.id, x: equation.coefficients.x, y: equation.coefficients.y, target: equation.targetArea,
})))
const laneColumns = ref(props.config.laneColumns)
const error = ref('')
watch(() => props.config, config => {
  equations.value = config.system.equations.map(equation => ({
    id: equation.id, x: equation.coefficients.x, y: equation.coefficients.y, target: equation.targetArea,
  }))
  laneColumns.value = config.laneColumns
  error.value = ''
})
function apply() {
  if (props.disabled) return
  const parsed = systemsBoardConfigSchema.safeParse({
    ...props.config,
    laneColumns: Number(laneColumns.value),
    system: { equations: equations.value.map(equation => ({
      id: equation.id,
      coefficients: { x: Number(equation.x), y: Number(equation.y) },
      targetArea: Number(equation.target),
    })) },
  })
  if (!parsed.success) {
    error.value = 'Check the coefficients, totals and row capacity against the limits shown.'
    return
  }
  error.value = ''
  emit('apply', parsed.data)
}
</script>

<template>
  <details class="problem-editor">
    <summary>Edit equations</summary>
    <form aria-label="Custom system" @submit.prevent="apply">
      <p>Enter positive whole-number coefficients up to {{ systemsLimits.maxCoefficient }}. Row lengths can use several rods.</p>
      <fieldset v-for="(equation, index) in equations" :key="equation.id" :disabled="disabled">
        <legend>Equation {{ index + 1 }}</legend>
        <label>x coefficient <input v-model.number="equation.x" type="number" min="1" :max="systemsLimits.maxCoefficient" step="1" required></label>
        <span>x +</span>
        <label>y coefficient <input v-model.number="equation.y" type="number" min="1" :max="systemsLimits.maxCoefficient" step="1" required></label>
        <span>y =</span>
        <label>Total <input v-model.number="equation.target" type="number" min="0" :max="systemsLimits.maxTargetArea" step="1" required></label>
      </fieldset>
      <label>Row capacity <input v-model.number="laneColumns" type="number" min="1" :max="systemsLimits.maxLaneColumns" step="1" required :disabled="disabled"></label>
      <button type="submit" :disabled="disabled">Apply equations</button>
      <p>Clear placed rods and delete captured steps before applying a different system.</p>
      <p v-if="error" role="alert">{{ error }}</p>
    </form>
  </details>
</template>

<style scoped>
.problem-editor { padding-block: 6px; }
form { display: grid; gap: 12px; padding-block: 12px; }
fieldset { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; border: 1px solid var(--mt-border); padding: 12px; border-radius: var(--radius-md); }
label { display: inline-flex; flex-direction: column; gap: 4px; }
input { width: 7rem; }
input, button { min-height: 40px; padding: 6px 10px; border: 1px solid var(--mt-border); border-radius: var(--radius-md); background: var(--mt-bg-elevated); color: var(--mt-text); font: inherit; }
button { justify-self: start; }
p { margin: 0; font-size: 0.875rem; }
</style>
