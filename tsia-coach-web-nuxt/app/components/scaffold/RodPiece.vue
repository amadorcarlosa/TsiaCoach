<script setup lang="ts">
const props = withDefaults(defineProps<{
  length: number
  label: string
  tone?: 'red' | 'white' | 'ink' | 'teal'
  interactive?: boolean
  selected?: boolean
  dimmed?: boolean
}>(), {
  tone: 'ink',
  interactive: false,
  selected: false,
  dimmed: false
})

const emit = defineEmits<{
  select: []
}>()

const style = computed(() => ({
  '--rod-length': String(props.length)
}))
</script>

<template>
  <component
    :is="interactive ? 'button' : 'div'"
    :type="interactive ? 'button' : undefined"
    class="rod-piece"
    :class="[
      `is-${tone}`,
      { 'is-interactive': interactive, 'is-selected': selected, 'is-dimmed': dimmed }
    ]"
    :style="style"
    :aria-pressed="interactive ? selected : undefined"
    :aria-label="interactive ? `${label}, length ${length}` : undefined"
    @click="interactive && emit('select')"
  >
    <span class="rod-label">{{ label }}</span>
  </component>
</template>

<style scoped>
.rod-piece {
  --rod-unit: clamp(0.75rem, 2.3vw, 1.55rem);
  display: grid;
  width: calc(var(--rod-length) * var(--rod-unit));
  min-width: 2.4rem;
  height: 2.75rem;
  place-items: center;
  border: 1px solid rgb(15 23 42 / 0.2);
  border-radius: 0.42rem;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.45),
    0 2px 0 rgb(15 23 42 / 0.14);
  color: #fff;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    opacity 160ms ease;
}

.rod-piece.is-red {
  background: linear-gradient(180deg, #e95a57, #c9373b);
  border-color: #a82c32;
}

.rod-piece.is-white {
  background: linear-gradient(180deg, #fffef9, #ede8dc);
  border-color: #aaa398;
  color: #263238;
}

.rod-piece.is-ink {
  background: linear-gradient(180deg, #284c55, #18323a);
  border-color: #10272d;
}

.rod-piece.is-teal {
  background: linear-gradient(180deg, #15998d, #0f766e);
  border-color: #0b5c57;
}

.rod-piece.is-interactive {
  cursor: pointer;
  font: inherit;
}

.rod-piece.is-interactive:hover {
  transform: translateY(-2px);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.45),
    0 5px 0 rgb(15 23 42 / 0.16);
}

.rod-piece.is-interactive:focus-visible {
  outline: 3px solid rgb(20 184 166 / 0.32);
  outline-offset: 3px;
}

.rod-piece.is-selected {
  box-shadow:
    0 0 0 3px var(--color-primary-300),
    0 5px 0 rgb(15 23 42 / 0.16);
  transform: translateY(-2px);
}

.rod-piece.is-dimmed {
  opacity: 0.22;
}

.rod-label {
  overflow: hidden;
  padding-inline: 0.35rem;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.78rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .rod-piece {
    transition: none;
  }
}
</style>
