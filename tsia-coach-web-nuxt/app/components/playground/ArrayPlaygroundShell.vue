<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import PlaygroundActionButton from '~/components/playground/PlaygroundActionButton.vue'
import PlaygroundRodTray from '~/components/playground/PlaygroundRodTray.vue'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import type { ArrayRodOrientation } from '~/components/rod/array/array-rod.types'

defineProps<{
  blocked: boolean
  canOrient: (orientation: ArrayRodOrientation) => boolean
  editingDisabled: boolean
  message: string
  orientations: readonly ArrayRodOrientation[]
  phonePortrait: boolean
  pieceCount: number
  previewNotice: string
  removeDisabled: boolean
  // Lets a board wider than the viewport scroll; the portrait preview still clips.
  scrollable?: boolean
  selectedOrientation?: ArrayRodOrientation
  setBoardViewport: (element: Element | ComponentPublicInstance | null) => void
  setWorkspaceTools: (element: Element | ComponentPublicInstance | null) => void
  toolbarLabel: string
  trayId: string
  trayOpen: boolean
  viewportClass: string
}>()

const emit = defineEmits<{
  boardLostPointerCapture: [event: PointerEvent]
  boardPointerDown: [event: PointerEvent]
  chooseRod: [value: CuisenaireRodValue]
  orient: [orientation: ArrayRodOrientation]
  removeSelected: []
  updateTrayOpen: [value: boolean]
}>()
</script>

<template>
  <div class="array-shell">
    <p v-if="phonePortrait" role="status">
      {{ previewNotice }}
    </p>

    <div :ref="setWorkspaceTools">
      <slot name="tools-start" />

      <div class="array-shell-toolbar" :aria-label="toolbarLabel">
        <button
          type="button"
          :aria-expanded="trayOpen"
          :aria-controls="trayId"
          @click="emit('updateTrayOpen', !trayOpen)"
        >
          {{ trayOpen ? 'Hide rods' : 'Show rods' }}
        </button>

        <PlaygroundActionButton
          v-for="orientation in orientations"
          :key="orientation"
          class="orientation-button"
          :disabled="!canOrient(orientation)"
          :pressed="selectedOrientation === orientation"
          @click="emit('orient', orientation)"
        >
          {{ orientation }}
        </PlaygroundActionButton>

        <PlaygroundActionButton
          :disabled="removeDisabled"
          @click="emit('removeSelected')"
        >
          Remove selected rod
        </PlaygroundActionButton>
      </div>

      <div v-show="trayOpen" :id="trayId">
        <PlaygroundRodTray
          layout="wrap"
          :disabled="blocked"
          @choose="emit('chooseRod', $event)"
        />
      </div>
    </div>

    <slot name="before-board" />

    <div
      :ref="setBoardViewport"
      class="array-shell-viewport"
      :class="[viewportClass, {
        'marquee-enabled': !editingDisabled,
        'array-shell-viewport--scrollable': scrollable && !phonePortrait,
        'array-shell-viewport--clipped': scrollable && phonePortrait,
      }]"
      tabindex="-1"
      @pointerdown.capture="emit('boardPointerDown', $event)"
      @lostpointercapture="emit('boardLostPointerCapture', $event)"
    >
      <slot name="board" />
    </div>

    <slot name="menu" />

    <slot name="after-workspace" />

    <p role="status" aria-live="polite">{{ message }}</p>
    <p>{{ pieceCount }} objects on the board</p>
  </div>
</template>

<style scoped>
.marquee-enabled :deep([data-grid-world]) {
  touch-action: none;
  user-select: none;
}

.array-shell {
  max-width: 1100px;
  min-width: 0;
  margin-inline: auto;
  padding: 8px;
}

.array-shell-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-block: 8px;
}

.array-shell-toolbar > button {
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-md);
  color: var(--mt-text);
  background: var(--mt-bg-elevated);
  font: inherit;
  cursor: pointer;
}

.array-shell-toolbar > button:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.orientation-button {
  text-transform: capitalize;
}

.array-shell-viewport {
  width: 100%;
  min-width: 0;
}

.array-shell-viewport--scrollable {
  overflow-x: auto;
}

.array-shell-viewport--clipped {
  overflow-x: hidden;
}
</style>
