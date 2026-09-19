<script setup lang="ts">
import { baseTenCatalog, playableDenominations, type PlayableDenomination } from './base10.types'
defineProps<{ disabled: boolean }>()
defineEmits<{ choose: [denomination: PlayableDenomination] }>()
</script>
<template>
  <div class="base-ten-tray" aria-label="Base-ten blocks">
    <button
v-for="denomination in playableDenominations" :key="denomination" type="button" :disabled="disabled"
      :style="{ '--fill': baseTenCatalog[denomination].appearance.fill }" @click="$emit('choose', denomination)">
      <span aria-hidden="true" /> Add {{ baseTenCatalog[denomination].value.toLocaleString('en-US') }}
    </button>
  </div>
</template>
<style scoped>
.base-ten-tray { display: flex; flex-wrap: wrap; gap: 8px; }
button { min-height: 44px; padding: 8px 12px; border: 1px solid var(--mt-border); border-radius: var(--radius-md); background: var(--mt-bg-elevated); color: var(--mt-text); cursor: pointer; }
button:disabled { opacity: .5; cursor: default; }
span { display: inline-block; width: 14px; height: 14px; background: var(--fill); margin-right: 4px; border: 1px solid #0004; }
</style>
