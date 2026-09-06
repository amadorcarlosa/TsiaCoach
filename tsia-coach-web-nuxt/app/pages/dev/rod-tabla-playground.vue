<script setup lang="ts">
import RodTabla from '~/components/tabla/RodTabla.vue'
import { getTablaGeometry } from '~/components/tabla/tabla.geometry'
import { CuisenaireRodValues, getRodDefinition } from '~/components/rod/rod.types'

const targetCount = 3
const geometry = getTablaGeometry(targetCount)
const workspaceStyle = {
  '--grid-top-inset': `${geometry.topInset}px`,
}
const rods = Object.values(CuisenaireRodValues).map(getRodDefinition)
</script>

<template>
  <div class="tabla-playground">
    <div class="workspace" :style="workspaceStyle">
      <div class="workspace-tray">
        <RodTray :items="rods" :unit-size="16" embedded />
      </div>

      <RodTabla
        :target-count="targetCount"
        viewport-padding="var(--workspace-padding-y) 16px"
        embedded
      />
    </div>
  </div>
</template>

<style scoped>
.tabla-playground {
  padding: 16px;
}

.workspace {
  --grid-top-inset: 0px;
  --workspace-padding-y: 24px;

  display: flex;
  align-items: stretch;
  gap: 0;
  width: max-content;
  max-width: calc(100% - 32px);
  margin: 16px;
  padding: 0;
  overflow: auto;
  background: var(--mt-bg-elevated);
  color: var(--mt-text);
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
}

.workspace-tray {
  flex: 0 0 auto;
  padding: calc(var(--workspace-padding-y) + var(--grid-top-inset)) 16px var(--workspace-padding-y);
  border-right: 1px solid var(--mt-border);
}
</style>
