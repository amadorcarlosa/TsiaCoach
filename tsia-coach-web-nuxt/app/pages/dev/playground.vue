<script setup lang="ts">
import { ref } from 'vue'

import { PlayGroundItems } from '~/components/playground/playground.types'
import ArrayRodPlayground from '~/components/playground/ArrayRodPlayground.vue'
import BarRodPlayground from '~/components/playground/BarRodPlayground.vue'

const tabs = PlayGroundItems.map(item => ({
  ...item,
  value: item.slot,
}))

const activeTab = ref('barModelPlayground')
</script>

<template>
  <UTabs
      v-model="activeTab"
      :items="tabs"
      :unmount-on-hide="false"
  >
    <template #arrayModelPlayground>
      <ArrayRodPlayground
          :active="activeTab === 'arrayModelPlayground'"
      />
    </template>

    <template #barModelPlayground>
      <BarRodPlayground
          :active="activeTab === 'barModelPlayground'"
      />
    </template>
  </UTabs>
</template>
