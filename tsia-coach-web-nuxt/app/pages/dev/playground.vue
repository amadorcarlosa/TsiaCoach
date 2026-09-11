<script setup lang="ts">
import { ref, watch } from 'vue'

import { playgroundTabs, type PlaygroundId } from '~/components/playground/playground.types'
import ArrayRodPlayground from '~/components/playground/ArrayRodPlayground.vue'
import BarRodPlayground from '~/components/playground/BarRodPlayground.vue'
import FractionPlayground from '~/components/playground/FractionPlayground.vue'

const tabs = playgroundTabs.map(({ id, label }) => ({
  label,
  value: id,
  slot: id,
}))

const activeTab = ref<PlaygroundId>('barModelPlayground')
const cancellationVersion = ref(0)
const readCancelVersion = () => cancellationVersion.value

function cancelSceneMovement(): void {
  cancellationVersion.value++
}

function onTabPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return

  const target = event.target
  if (!(target instanceof Element)) return

  const tab = target.closest('[role="tab"]')

  if (tab?.getAttribute('aria-selected') === 'false') {
    // Cancel before the ensuing release/click can settle movement.
    cancelSceneMovement()
  }
}

// Also covers keyboard and programmatic tab changes.
watch(activeTab, cancelSceneMovement, { flush: 'sync' })
</script>

<template>
  <div @pointerdown.capture="onTabPointerDown">
    <UTabs
      v-model="activeTab"
      :items="tabs"
      :unmount-on-hide="false"
    >
      <template #arrayModelPlayground>
        <ArrayRodPlayground
          :active="activeTab === 'arrayModelPlayground'"
          :cancel-version="readCancelVersion"
        />
      </template>

      <template #barModelPlayground>
        <BarRodPlayground
          :active="activeTab === 'barModelPlayground'"
          :cancel-version="readCancelVersion"
        />
      </template>
      <template #fractionModelPlayground>
        <FractionPlayground
            :active="activeTab === 'fractionModelPlayground'"
            :cancel-version="readCancelVersion"
        />
      </template>
    </UTabs>
  </div>
</template>
