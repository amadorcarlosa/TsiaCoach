<script setup lang="ts">
import Grid3D from '~/components/grid/Grid3D.vue'

definePageMeta({ layout: false })
const fixture = { cols: 12, rows: 8, cellSize: 20, tiltDegrees:60 }
</script>

<template>
  <main>

    <Grid3D v-bind="fixture" />
  </main>
</template>

<style scoped>
main { max-width: 1040px; margin: 0 auto; padding: 32px 20px; }
h1 { font-size: 32px; font-weight: 600; }
p { margin: 8px 0 24px; color: var(--mt-text-muted); }
</style>
