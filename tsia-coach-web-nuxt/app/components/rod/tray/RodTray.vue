<script setup lang="ts">

import  {
  type RodTrayProps,
  ariaTray,
  ariaRod, } from './rodTray.types'
import {
  type CuisenaireRodValue,
  cuisenaireRodPalette} from "~/components/rod/rod.types.ts";

import styles from './rodTray.styles.module.css'
import CuisenaireRod from "~/components/rod/cuisenaire/CuisenaireRod.vue";



defineProps<RodTrayProps>()

const emit = defineEmits<{
  choose: [value: CuisenaireRodValue]
}>()
</script>

<template>
  <aside 
      :class="[
          styles.tray, 
          embedded && styles.embedded,
          layout=== 'wrap' && styles.wrap
          ]" 
      :aria-label="ariaTray" >
    <button
        v-for="item in items"
        :key="item.value"
        :class="styles.choice"
        type="button"
        :aria-label=ariaRod(item.number)
        :disabled="disabled"
        @click="emit('choose', item.value)"
    >
      <span :class="styles.preview" aria-hidden="true">
 <CuisenaireRod
     style="--rod-label-offset: -3px"
     :dimensions="{ width: item.value, depth: 1, height: 1 }"
     :unit-size="unitSize"
     :appearance="cuisenaireRodPalette[item.value]"
     :label="String(item.value)"
 />
      </span>

     
    </button>
  </aside>
</template>
