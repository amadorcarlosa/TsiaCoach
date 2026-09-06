<script setup lang="ts">
import { rodPalette, type RodLength } from './rodPalette'
import TowerRodFaces from './TowerRodFaces.vue'

/** SVG extrusion gives a raised rod on the flat board; positions and lengths are grid units. */
const props = defineProps<{ length: RodLength, x: number, y: number, vertical?: boolean, tower?: boolean, rotation?: number, selected?: boolean }>()
const emit = defineEmits<{ select: [], rotate: [direction: 1 | -1] }>()
const color = computed(() => rodPalette[props.length])
const width = computed(() => props.length)
const height = 0.72
const angle = computed(() => props.rotation ?? (props.vertical ? 90 : 0))
const turn = computed(() => {
  const offset: Record<number, string> = { 0: '0 0', 90: '1 0', 180: `${props.length} 1`, 270: `0 ${props.length}` }
  return `translate(${offset[angle.value]}) rotate(${angle.value})`
})
</script>

<template>
  <g
    :transform="`translate(${x} ${y})`" data-role="rod" :data-length="length" :data-x="x" :data-y="y" :data-vertical="!!vertical" :data-rotation="angle"
    role="button" tabindex="0" :data-orientation="tower ? 'tower' : vertical ? 'vertical' : 'horizontal'" :aria-label="`${color.name} rod, length ${length}, ${tower ? 'tower' : vertical ? 'vertical' : 'horizontal'}`" :aria-pressed="!!selected"
    @click="emit('select')" @keydown.enter.prevent="emit('select')" @keydown.space.prevent="emit('select')" @keydown.r.prevent.stop="emit('rotate', $event.shiftKey ? -1 : 1)">
    <title>{{ color.name }} Cuisenaire rod, {{ length }} {{ length === 1 ? 'unit' : 'units' }}</title>
    <TowerRodFaces v-if="tower" :length="length" :fill="color.fill" :ink="color.ink" :selected="selected" />
    <g v-else :transform="turn">
    <rect v-if="selected" x="-0.08" y="-0.08" :width="width + 0.32" :height="height + 0.38" rx="0.06" fill="none" stroke="#fff" stroke-width="0.07" />
    <rect x="0.1" y="0.16" :width="width + 0.12" :height="height + 0.12" rx="0.06" fill="#0b2239" opacity="0.35" />
    <g :fill="color.fill" stroke="#142638" stroke-width="0.025" stroke-linejoin="round">
      <path :d="`M0 ${height} H${width} l.16 .22 H.16 Z`" />
      <path :d="`M${width} 0 l.16 .22 v${height} L${width} ${height} Z`" />
      <rect :width="width" :height="height" rx="0.035" />
    </g>
    <path :d="`M0 ${height} H${width} l.16 .22 H.16 Z`" fill="#000" opacity="0.2" />
    <path :d="`M${width} 0 l.16 .22 v${height} L${width} ${height} Z`" fill="#000" opacity="0.32" />
    <path :d="`M.06 .09 H${width - 0.06}`" stroke="#fff" stroke-width="0.035" opacity="0.45" />
    <text :transform="`rotate(${-angle} ${width / 2} ${height / 2})`" :x="width / 2" :y="height / 2" :fill="color.ink" text-anchor="middle" dominant-baseline="middle" font-size="0.36" font-weight="600">{{ length }}</text>
    </g>
  </g>
</template>

<style scoped>
g[role="button"] { cursor: pointer; }
g[role="button"]:focus-visible { outline: 2px solid white; outline-offset: 3px; }
</style>
