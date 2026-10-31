<script setup lang="ts">
defineProps<{ zoom: number; panMode: boolean; disabled?: boolean }>()
const emit = defineEmits<{ zoom: [value: number]; reset: []; togglePan: [] }>()
</script>

<template>
  <div class="board-view-controls" role="group" aria-label="Board view">
    <!-- Direct touch activation avoids a swallowed compatibility click after panning.
         Preventing touchend's default also prevents a second synthesized activation. -->
    <button
      type="button"
      :disabled="disabled || zoom <= 0.25"
      aria-label="Zoom out"
      @touchend.prevent="emit('zoom', zoom - 0.25)"
      @click="emit('zoom', zoom - 0.25)"
    >-</button>
    <label>Zoom
      <select
        aria-label="Zoom"
        :value="zoom"
        :disabled="disabled"
        @change="emit('zoom', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="value in [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]" :key="value" :value="value">
          {{ Math.round(value * 100) }}%
        </option>
      </select>
    </label>
    <button
      type="button"
      :disabled="disabled || zoom >= 2"
      aria-label="Zoom in"
      @touchend.prevent="emit('zoom', zoom + 0.25)"
      @click="emit('zoom', zoom + 0.25)"
    >+</button>
    <button
      type="button"
      :disabled="disabled"
      :aria-pressed="panMode"
      @touchend.prevent="emit('togglePan')"
      @click="emit('togglePan')"
    >Pan board</button>
    <button
      type="button"
      :disabled="disabled"
      @touchend.prevent="emit('reset')"
      @click="emit('reset')"
    >Reset view</button>
    <span class="hint">Scroll to explore. Turn on Pan board to drag the view.</span>
  </div>
</template>

<style scoped>
.board-view-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-block: 8px;
}
button, select {
  touch-action: manipulation;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-md);
  background: var(--mt-bg-elevated);
  color: var(--mt-text);
  font: inherit;
}
button[aria-pressed="true"] { outline: 2px solid var(--ui-primary); }
.hint { font-size: 0.875rem; color: var(--ui-text-muted); }
</style>
