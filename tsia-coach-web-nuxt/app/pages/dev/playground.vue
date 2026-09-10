<script setup lang="ts">
import { provide, readonly, ref, watch } from 'vue'

import { PlayGroundItems } from '~/components/playground/playground.types'
import { sceneCancellationKey } from '~/components/rod/scene/scene-cancellation'
import ArrayRodPlayground from '~/components/playground/ArrayRodPlayground.vue'
import BarRodPlayground from '~/components/playground/BarRodPlayground.vue'

const tabs = PlayGroundItems.map(item => ({
  ...item,
  value: item.slot,
}))

const activeTab = ref('barModelPlayground')
const cancellationVersion = ref(0)

provide(sceneCancellationKey, readonly(cancellationVersion))

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
// Keep your existing activeTab declaration.
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
        />
      </template>

      <template #barModelPlayground>
        <BarRodPlayground
          :active="activeTab === 'barModelPlayground'"
        />
      </template>
    </UTabs>
  </div>
</template>
