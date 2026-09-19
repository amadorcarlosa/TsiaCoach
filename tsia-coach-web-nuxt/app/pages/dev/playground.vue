<script setup lang="ts">
import { ref, watch } from 'vue'

import { playgroundTabs, type PlaygroundId } from '~/components/playground/playground.types'
import ArrayRodPlayground from '~/components/playground/ArrayRodPlayground.vue'
import ArrayBaseTenPlayground from '~/components/playground/ArrayBaseTenPlayground.vue'
import AlgebraTilePlayground from '~/components/playground/AlgebraTilePlayground.vue'
import BarRodPlayground from '~/components/playground/BarRodPlayground.vue'
import FractionPlayground from '~/components/playground/FractionPlayground.vue'
import MathTablaPlayground from '~/components/playground/MathTablaPlayground.vue'

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
      <template #baseTenPlayground>
        <ArrayBaseTenPlayground :active="activeTab === 'baseTenPlayground'" :cancel-version="readCancelVersion" />
      </template>
      <template #algebraTilePlayground>
        <AlgebraTilePlayground :active="activeTab === 'algebraTilePlayground'" :cancel-version="readCancelVersion" />
      </template>
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
      <template #mathTablaPlayground>
        <MathTablaPlayground
          :active="activeTab === 'mathTablaPlayground'"
          :cancel-version="readCancelVersion"
        />
      </template>
    </UTabs>
  </div>
</template>
