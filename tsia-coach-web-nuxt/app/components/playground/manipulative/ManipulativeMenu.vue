<script setup lang="ts" generic="Action">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ManipulativeChoice } from './manipulative.types'

const props = defineProps<{
  x: number
  y: number
  label: string
  choices: readonly ManipulativeChoice<Action>[]
}>()

const emit = defineEmits<{ action: [action: Action]; close: [] }>()

const element = ref<HTMLElement | null>(null)
const left = ref(props.x)
const top = ref(props.y)

function outside(event: PointerEvent): void {
  if (!element.value?.contains(event.target as Node)) emit('close')
}

function keydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' || event.key === 'Tab') {
    event.preventDefault()
    emit('close')
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

  event.preventDefault()
  const items = [...element.value!.querySelectorAll<HTMLButtonElement>('button')]
  const index = items.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? items.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[next]?.focus()
}

onMounted(async () => {
  await nextTick()
  // Keep the menu on screen near the requested point.
  const bounds = element.value!.getBoundingClientRect()
  left.value = Math.max(8, Math.min(props.x, window.innerWidth - bounds.width - 8))
  top.value = Math.max(8, Math.min(props.y, window.innerHeight - bounds.height - 8))
  element.value?.querySelector('button')?.focus()
  window.addEventListener('pointerdown', outside, true)
})

onBeforeUnmount(() => window.removeEventListener('pointerdown', outside, true))
</script>

<template>
  <Teleport to="body">
    <div
      ref="element"
      class="manipulative-menu"
      role="menu"
      tabindex="-1"
      :aria-label="label"
      :style="{ left: `${left}px`, top: `${top}px` }"
      @keydown="keydown"
    >
      <button
        v-for="choice in choices"
        :key="choice.label"
        type="button"
        role="menuitem"
        :aria-disabled="!choice.result.allowed"
        @click="choice.result.allowed && emit('action', choice.action)"
      >
        {{ choice.label }}<small v-if="!choice.result.allowed">
          {{ choice.result.reason }}
        </small>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.manipulative-menu {
  position: fixed;
  z-index: 1000;
  width: 260px;
  max-height: calc(100vh - 16px);
  overflow: auto;
  padding: 8px;
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-md);
  background: var(--mt-bg-elevated);
  color: var(--mt-text);
  box-shadow: 0 8px 30px #0003;
}

button {
  display: block;
  width: 100%;
  min-height: 44px;
  text-align: left;
  padding: 8px;
  border-radius: 4px;
}

button:focus-visible {
  outline: 2px solid var(--ui-primary);
}

button[aria-disabled=true] {
  opacity: .6;
}

small {
  display: block;
  font-size: 12px;
}
</style>
