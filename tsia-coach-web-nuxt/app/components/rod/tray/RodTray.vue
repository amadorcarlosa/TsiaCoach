<script setup lang="ts">

import  {
  type RodTrayProps,
  ariaTray,
  ariaRod, } from './rodTray.types'
import {
  type CuisenaireRodValue,
  cusisenaireRodPalette} from "~/components/rod/rod.types.ts";
import CuisenaireRod from "~/components/rod/CuisenaireRod.vue";
import styles from './rodTray.styles.module.css'


defineProps<RodTrayProps>()

const emit = defineEmits<{
  choose: [value: CuisenaireRodValue]
}>()
</script>

<template>
  <aside :class="styles.tray" :aria-label="ariaTray" >
    <button
        v-for="item in items"
        :key="item.value"
        :class="styles.choice"
        type="button"
        :aria-label=ariaRod(item.number)
        @click="emit('choose', item.value)"
    >
      <span :class="styles.preview" aria-hidden="true">
 <CuisenaireRod
     style="--rod-label-offset: -3px"
     :dimensions="{ width: item.value, depth: 1, height: 1 }"
     :unit-size="unitSize"
     :appearance="cusisenaireRodPalette[item.value]"
     :label="String(item.value)"
 />
      </span>

      <span :class="styles.value"></span>
    </button>
  </aside>
</template>
