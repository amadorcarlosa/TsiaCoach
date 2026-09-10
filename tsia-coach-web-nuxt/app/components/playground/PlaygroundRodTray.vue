<script setup lang="ts">
import RodTray from '~/components/rod/tray/RodTray.vue'
import {
  CuisenaireRodValues,
  getRodDefinition,
  type CuisenaireRodValue,
} from '~/components/rod/rod.types'

withDefaults(defineProps<{
  disabled?: boolean
  layout?: 'wrap' | 'vertical'
}>(), {
  layout: 'wrap',
})

const emit = defineEmits<{
  choose: [value: CuisenaireRodValue]
}>()

const items = Object.values(CuisenaireRodValues)
  .map(getRodDefinition)
</script>

<template>
  <RodTray
    :items="items"
    :unit-size="16"
    :layout="layout"
    :disabled="disabled"
    embedded
    @choose="emit('choose', $event)"
  />
</template>
