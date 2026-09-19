<script setup lang="ts">
import type { AlgebraTileAppearance } from './algebra-tile.types'
import CuisenaireRod from '~/components/rod/cuisenaire/CuisenaireRod.vue'
defineProps<{ dimensions: { width: number; depth: number }; unitSize: number; appearance: AlgebraTileAppearance; label: string }>()
</script>
<template>
  <CuisenaireRod
    aria-hidden="true"
    :dimensions="{ ...dimensions, height: 1 }"
    :unit-size="unitSize"
    :appearance="appearance"
    :label="label"
  />
</template>
