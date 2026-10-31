<script setup lang="ts" generic="Action">
import type { ComponentPublicInstance, StyleValue } from 'vue'
import PlaygroundActionButton from '~/components/playground/PlaygroundActionButton.vue'
import type { ManipulativeChoice } from './manipulative.types'

/**
 * Layout shared by the non-rod manipulative playgrounds (base-ten blocks,
 * algebra tiles): toolbar of scene actions, a collapsible tray, the board
 * viewport, the context menu slot, and the status lines. Each playground
 * supplies its tray, board pieces and summary through slots.
 */
withDefaults(defineProps<{
  label: string
  toolbarLabel: string
  /** Plural noun for the tray toggle, e.g. 'blocks' gives "Hide blocks". */
  trayNoun: string
  trayId: string
  trayOpen: boolean
  choices: readonly ManipulativeChoice<Action>[]
  /** Disables every action button, e.g. while a marquee is open. */
  actionsDisabled?: boolean
  phonePortrait: boolean
  previewNotice: string
  viewportLabel: string
  viewportClass?: unknown
  /** Board drags draw a marquee, so touch must not scroll or select text. */
  marquee?: boolean
  viewportStyle?: StyleValue
  message: string
  setViewport: (element: Element | ComponentPublicInstance | null) => void
  setTools?: (element: Element | ComponentPublicInstance | null) => void
}>(), {
  actionsDisabled: false,
  marquee: false,
  viewportClass: undefined,
  viewportStyle: undefined,
  setTools: undefined,
})

const emit = defineEmits<{
  updateTrayOpen: [value: boolean]
  action: [action: Action]
  pointerdown: [event: PointerEvent]
  pointermove: [event: PointerEvent]
  pointerup: [event: PointerEvent]
  cancel: []
  lostpointercapture: [event: PointerEvent]
  scroll: []
}>()
</script>

<template>
  <section
    class="manipulative-playground"
    :aria-label="label"
  >
    <p
      v-if="phonePortrait"
      role="status"
    >
      {{ previewNotice }}
    </p>

    <div :ref="setTools">
      <div
        class="toolbar"
        role="toolbar"
        :aria-label="toolbarLabel"
      >
        <button
          type="button"
          class="tray-toggle"
          :aria-expanded="trayOpen"
          :aria-controls="trayId"
          @click="emit('updateTrayOpen', !trayOpen)"
        >
          {{ trayOpen ? `Hide ${trayNoun}` : `Show ${trayNoun}` }}
        </button>
        <PlaygroundActionButton
          v-for="choice in choices"
          :key="choice.label"
          :disabled="!choice.result.allowed || actionsDisabled"
          :title="choice.result.allowed ? choice.label : choice.result.reason"
          @click="emit('action', choice.action)"
        >
          {{ choice.label }}
        </PlaygroundActionButton>
      </div>

      <div
        v-show="trayOpen"
        :id="trayId"
      >
        <slot name="tray" />
      </div>
    </div>

    <slot name="before-board" />

    <!-- A focusable scroll container: Escape cancels an in-progress marquee or
         drag. Pieces inside are the real controls; no ARIA widget role fits. -->
    <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
    <div
      :ref="setViewport"
      class="manipulative-viewport"
      :class="[viewportClass, { 'marquee-enabled': marquee }]"
      :style="viewportStyle"
      tabindex="0"
      role="region"
      :aria-label="viewportLabel"
      @pointerdown.capture="emit('pointerdown', $event)"
      @pointermove="emit('pointermove', $event)"
      @pointerup="emit('pointerup', $event)"
      @pointercancel="emit('cancel')"
      @lostpointercapture="emit('lostpointercapture', $event)"
      @scroll="emit('scroll')"
      @keydown.esc="emit('cancel')"
    >
      <slot name="board" />
    </div>

    <slot name="menu" />

    <p
      role="status"
      aria-live="polite"
    >
      {{ message }}
    </p>
    <slot name="summary" />
  </section>
</template>

<style scoped>
.manipulative-playground {
  max-width: 1100px;
  margin-inline: auto;
  min-width: 0;
  padding: 8px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-block: 8px;
}

/* Also styles slotted toolbars (e.g. base-ten's board-view controls). */
.manipulative-playground :deep(.toolbar button) {
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-md);
  background: var(--mt-bg-elevated);
  color: var(--mt-text);
}

.tray-toggle {
  font: inherit;
  cursor: pointer;
}

.tray-toggle:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.manipulative-viewport {
  width: 100%;
  min-width: 0;
}

.marquee-enabled :deep([data-grid-world]) {
  touch-action: none;
  user-select: none;
}

.manipulative-viewport:focus-visible {
  outline: 2px solid var(--ui-primary);
}
</style>
