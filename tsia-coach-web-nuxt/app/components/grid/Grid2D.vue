<script setup lang="ts">
const props = withDefaults(defineProps<{ cols?: number, rows?: number, headroom?: number }>(), { cols: 12, rows: 8, headroom: 0 })
const zoom = ref(1)
const ready = ref(false)
onMounted(() => { ready.value = true })
const valid = computed(() => [props.cols, props.rows].every(value => Number.isInteger(value) && value > 0 && value <= 100))
const viewBox = computed(() => {
  const width = props.cols * 1.25 / zoom.value
  const height = (props.rows * 1.25 + props.headroom) / zoom.value
  return `${(props.cols - width) / 2} ${(props.rows - height - props.headroom) / 2} ${width} ${height}`
})
watch(() => [props.cols, props.rows], () => { zoom.value = 1 })
</script>

<template>
  <section class="grid-2d" aria-label="2D grid" :data-ready="ready">
    <div class="toolbar">
      <span>{{ cols }} × {{ rows }} · 1 square = 1 unit</span>
      <div>
        <button type="button" :disabled="!ready || !valid || zoom <= 0.5" aria-label="Zoom out" @click="zoom -= 0.25">−</button>
        <button type="button" :disabled="!ready || !valid || zoom >= 2" aria-label="Zoom in" @click="zoom += 0.25">+</button>
        <button type="button" :disabled="!ready || !valid" @click="zoom = 1">Reset view</button>
      </div>
    </div>
    <!-- SVG coordinates are board units: X right, Y down, origin at the top left. -->
    <svg v-if="valid" :viewBox="viewBox" role="group" :aria-label="`${cols} by ${rows} 2D grid`">
      <rect data-role="board" x="0" y="0" :width="cols" :height="rows" fill="#22557d" />
      <g stroke="#b9d4e7" stroke-width="1">
        <line v-for="x in cols + 1" :key="`x-${x}`" :x1="x - 1" y1="0" :x2="x - 1" :y2="rows" vector-effect="non-scaling-stroke" />
        <line v-for="y in rows + 1" :key="`y-${y}`" x1="0" :y1="y - 1" :x2="cols" :y2="y - 1" vector-effect="non-scaling-stroke" />
      </g>
      <slot />
    </svg>
    <p v-else role="alert">Grid dimensions must be whole numbers between 1 and 100.</p>
    <p v-if="valid">Top-down view · Use + and − to zoom</p>
  </section>
</template>

<style scoped>
.grid-2d { overflow: hidden; border: 1px solid #aec4d5; border-radius: 12px; background: #e5edf5; color: #173b57; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 16px; }
.toolbar div { display: flex; gap: 8px; }
button { border: 1px solid #829eb4; border-radius: 6px; padding: 6px 12px; background: #fff; cursor: pointer; }
button:focus-visible { outline: 3px solid #22557d; outline-offset: 3px; }
button:disabled { opacity: .5; cursor: default; }
svg { display: block; height: clamp(280px, 55vh, 560px); width: 100%; }
p { margin: 0; padding: 16px; font-size: 14px; }
</style>
