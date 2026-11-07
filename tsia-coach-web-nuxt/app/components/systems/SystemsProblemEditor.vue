<script setup lang="ts">

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
    laneColumns: Number(laneColumns.value),
    system: { equations: equations.value.map(equation => ({
      id: equation.id,
      coefficients: { x: Number(equation.x), y: Number(equation.y) },
      targetArea: Number(equation.target),
    })) },
  })
  if (!parsed.success) {
    return
  }
    error.value = ''
    emit('apply', parsed.data)
}
</script>

<template>
  <details class="problem-editor">
    <summary>Edit equations</summary>
        <legend>Equation {{ index + 1 }}</legend>
        <span>x +</span>
        <span>y =</span>
      </fieldset>
      <p>Clear placed rods and delete captured steps before applying a different system.</p>
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
