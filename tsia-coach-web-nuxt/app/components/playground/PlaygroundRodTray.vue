<script setup lang="ts">
import RodTray from '~/components/rod/tray/RodTray.vue'
import type { RodSign } from '~/components/rod/scene/rod.scene.types'
import {
  CuisenaireRodValues,
  getRodDefinition,
  type CuisenaireRodValue,
} from '~/components/rod/rod.types'

withDefaults(defineProps<{
  disabled?: boolean
  layout?: 'wrap' | 'vertical'
  sign?: RodSign
}>(), {
  layout: 'wrap',
  sign: 1,
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
    :sign="sign"
    embedded
    @choose="emit('choose', $event)"
  />
</template>
