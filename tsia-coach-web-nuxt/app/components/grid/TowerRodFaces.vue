<script setup lang="ts">
/** Oblique height projection: the base stays on one board cell. */
const props = defineProps<{ length: number, fill: string, ink: string, selected?: boolean }>()
const dx = computed(() => props.length * 0.25)
const dy = computed(() => -props.length * 0.65)
</script>

<template>
  <g data-role="tower-faces">
    <path :d="`M0 0 H1 L${1 + dx} ${1 - dy * 0.3} H${dx} Z`" fill="#0b2239" opacity="0.25" />
    <rect width="1" height="1" fill="none" :stroke="selected ? '#fff' : '#b9d4e7'" stroke-width="0.06" stroke-dasharray=".12 .08" />
    <g :fill="fill" :stroke="selected ? '#fff' : '#142638'" stroke-width="0.035" stroke-linejoin="round">
      <path :d="`M0 1 H1 L${1 + dx} ${1 + dy} H${dx} Z`" />
      <path :d="`M1 0 V1 L${1 + dx} ${1 + dy} V${dy} Z`" />
      <rect :x="dx" :y="dy" width="1" height="1" />
    </g>
    <path :d="`M0 1 H1 L${1 + dx} ${1 + dy} H${dx} Z`" fill="#000" opacity="0.16" />
    <path :d="`M1 0 V1 L${1 + dx} ${1 + dy} V${dy} Z`" fill="#000" opacity="0.32" />
    <text :x="dx + 0.5" :y="dy + 0.5" :fill="ink" text-anchor="middle" dominant-baseline="middle" font-size="0.36" font-weight="600">{{ length }}</text>
  </g>
</template>
