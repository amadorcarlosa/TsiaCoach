<script setup lang="ts">
defineProps<{
  disabled?: boolean
  pressed?: boolean
}>()
</script>

<template>
  <button
    type="button"
    class="playground-action"
    :disabled="disabled"
    :aria-pressed="pressed"
  >
    <slot />
  </button>
</template>

<style scoped>
.playground-action {
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-md);
  color: var(--mt-text);
  background: var(--mt-bg-elevated);
  font: inherit;
  cursor: pointer;
}

.playground-action:disabled {
  opacity: 0.5;
  cursor: default;
}

.playground-action:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.playground-action[aria-pressed="true"] {
  border-color: var(--ui-primary);
}
</style>
