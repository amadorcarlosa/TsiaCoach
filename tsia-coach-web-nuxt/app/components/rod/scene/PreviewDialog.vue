<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

/**
 * A modal confirmation for a previewed scene change. It owns no mathematics
 * and changes nothing: it shows the text it is given and reports which
 * button was chosen. The safe choice takes focus first; Escape keeps.
 */
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  /** Equations or steps, read in order. */
  lines: readonly string[]
  linesLabel?: string
  description: string
  confirmLabel: string
  keepLabel?: string
  /** Completed outcomes and refusals, announced politely. */
  announcement: string
}>(), {
  linesLabel: 'Steps',
  keepLabel: 'Keep rods',
})

const emit = defineEmits<{
  confirm: []
  keep: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const keepButton = ref<HTMLButtonElement | null>(null)
const id = useId()

watch(() => props.open, async open => {
  const element = dialog.value
  if (!element) return
  if (open && !element.open) {
    // Modal: the board behind becomes inert, Tab stays in the dialog and
    // Escape arrives as a cancel event.
    if (typeof element.showModal === 'function') element.showModal()
    else element.setAttribute('open', '')
    await nextTick()
    keepButton.value?.focus()
  } else if (!open && element.open) {
    if (typeof element.close === 'function') element.close()
    else element.removeAttribute('open')
  }
}, { flush: 'post' })

function onCancel(event: Event): void {
  // Escape keeps; the owning session, not the browser, closes the dialog.
  event.preventDefault()
  emit('keep')
}

onBeforeUnmount(() => {
  if (dialog.value?.open && typeof dialog.value.close === 'function') dialog.value.close()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="preview-dialog"
    :aria-labelledby="`${id}-title`"
    :aria-describedby="`${id}-description`"
    data-preview-dialog
    @cancel="onCancel"
  >
    <template v-if="open">
      <h2 :id="`${id}-title`">
        {{ title }}
      </h2>
      <ol
        class="preview-lines"
        :aria-label="linesLabel"
      >
        <li
          v-for="line in lines"
          :key="line"
        >
          {{ line }}
        </li>
      </ol>
      <p :id="`${id}-description`">
        {{ description }}
      </p>
      <div class="preview-actions">
        <button
          ref="keepButton"
          type="button"
          @click="emit('keep')"
        >
          {{ keepLabel }}
        </button>
        <button
          type="button"
          class="preview-confirm"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </template>
  </dialog>
  <p
    class="preview-status"
    role="status"
    aria-live="polite"
  >
    {{ announcement }}
  </p>
</template>

<style scoped>
/* Docked away from the board so the highlighted rods stay visible. */
.preview-dialog {
  position: fixed;
  inset: auto 16px 16px auto;
  width: min(400px, calc(100vw - 32px));
  margin: 0;
  padding: 16px;
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-md);
  color: var(--mt-text);
  background: var(--mt-bg-elevated);
  box-shadow: 0 8px 24px rgb(0 0 0 / 20%);
}

.preview-dialog::backdrop {
  background: rgb(0 0 0 / 8%);
}

.preview-dialog h2 {
  margin: 0 0 8px;
  font-size: 1.125rem;
  font-weight: 600;
}

.preview-lines {
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
  font-size: 1.125rem;
  font-variant-numeric: tabular-nums;
}

.preview-dialog p {
  margin: 0 0 12px;
}

.preview-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.preview-actions button {
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-md);
  color: var(--mt-text);
  background: var(--mt-bg-elevated);
  font: inherit;
  cursor: pointer;
}

.preview-actions .preview-confirm {
  border-color: var(--ui-primary);
  color: var(--ui-text-inverted, #fff);
  background: var(--ui-primary);
}

.preview-actions button:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.preview-status {
  margin: 0;
}
</style>
