<script setup lang="ts">
import type {
  ComponentPublicInstance,
  StyleValue,
} from 'vue'
import PlaygroundActionButton from '~/components/playground/PlaygroundActionButton.vue'
import PlaygroundRodTray from '~/components/playground/PlaygroundRodTray.vue'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'

defineProps<{
  ariaLabel: string
  boardWidth: number
  blocked: boolean
  compactLayout: boolean
  editingDisabled: boolean
  phonePortrait: boolean
  pieceCount: number
  removeDisabled: boolean
  setBoardViewport: (element: Element | ComponentPublicInstance | null) => void
  setWorkspaceTools: (element: Element | ComponentPublicInstance | null) => void
  shortLandscape: boolean
  trayId: string
  trayOpen: boolean
  workspaceStyle: StyleValue
}>()

const emit = defineEmits<{
  boardLostPointerCapture: [event: PointerEvent]
  boardPointerDown: [event: PointerEvent]
  removeSelected: []
  updateTrayOpen: [value: boolean]
  chooseRod: [value: CuisenaireRodValue]
}>()
</script>

<template>
  <div class="tabla-playground">
    <p
      v-if="phonePortrait"
      class="preview-notice"
      role="status"
    >
      <strong>Portrait preview: 0-12.</strong>
      Movement is disabled. Rotate to landscape to view all
      24 columns and move rods. Rods beyond 12 are preserved.
    </p>

    <div
      class="workspace"
      :style="workspaceStyle"
    >
      <div
        :ref="setWorkspaceTools"
        class="workspace-tools"
      >
        <div class="workspace-toolbar">
          <button
            type="button"
            class="tray-toggle"
            :aria-expanded="trayOpen"
            :aria-controls="trayId"
            @click="emit('updateTrayOpen', !trayOpen)"
          >
            {{ trayOpen ? 'Hide rods' : 'Show rods' }}
          </button>
          <PlaygroundActionButton
            :disabled="removeDisabled"
            @click="emit('removeSelected')"
          >
            Remove selected rod
          </PlaygroundActionButton>
          <span
            v-if="shortLandscape"
            class="toolbar-status"
            role="status"
          >
            {{ pieceCount }}
            {{ pieceCount === 1 ? 'object' : 'objects' }}
            on the board
          </span>
        </div>

        <div
          v-show="!compactLayout || trayOpen"
          :id="trayId"
          class="workspace-tray"
        >
          <PlaygroundRodTray
            :layout="compactLayout ? 'wrap' : 'vertical'"
            :disabled="blocked"
            @choose="emit('chooseRod', $event)"
          />
        </div>
      </div>

      <div
        :ref="setBoardViewport"
        tabindex="-1"
        class="board-viewport"
        :class="{ 'marquee-enabled': !editingDisabled }"
        role="region"
        :aria-label="ariaLabel"
        @pointerdown.capture="emit('boardPointerDown', $event)"
        @lostpointercapture="emit('boardLostPointerCapture', $event)"
      >
        <slot name="board-controls" />

        <div
          class="board-frame"
          :style="{ width: `${boardWidth}px` }"
        >
          <slot name="board" />
        </div>
      </div>

      <slot name="menu" />
    </div>

    <slot name="after-workspace" />

    <p
      v-if="!shortLandscape"
      class="position-status"
      role="status"
    >
      {{ pieceCount }}
      {{ pieceCount === 1 ? 'object' : 'objects' }}
      on the board
    </p>
  </div>
</template>

<style scoped>
.marquee-enabled :deep([data-grid-world]) {
  touch-action: none;
  user-select: none;
}

.tabla-playground {
  display: block;
  min-width: 0;
  padding: 8px;
}

.workspace {
  --grid-top-inset: 0px;
  --workspace-padding-y: 24px;

  display: flex;
  align-items: stretch;
  width: 100%;
  max-width: 1100px;
  min-width: 0;
  box-sizing: border-box;
  margin-inline: auto;

  background: var(--mt-bg-elevated);
  color: var(--mt-text);
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
}

.workspace-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-status {
  padding-right: 16px;
  font-size: 0.875rem;
  color: var(--mt-text-muted);
  white-space: nowrap;
}

.workspace-tools {
  flex: 0 0 auto;
  border-right: 1px solid var(--mt-border);
}

.workspace-tray {
  padding:
    calc(var(--workspace-padding-y) + var(--grid-top-inset))
    16px
    var(--workspace-padding-y);
}

.tray-toggle {
  display: none;
}

.board-viewport {
  flex: 1 1 0;
  min-width: 0;
  overflow: clip;
}

.board-frame {
  max-width: 100%;
  margin-inline: auto;
  clip-path: inset(0 16px);
}

.preview-notice,
.position-status {
  max-width: 1100px;
  margin: 8px auto;
  color: var(--mt-text-muted);
}

.preview-notice {
  padding: 12px;
  background: var(--mt-surface-2);
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-md);
}

.tray-toggle:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: -3px;
}

@media (max-width: 1119px), (max-height: 500px) and (orientation: landscape) {
  .workspace {
    flex-direction: column;
  }

  .workspace-tools {
    width: 100%;
    min-width: 0;
    border-right: 0;
    border-bottom: 1px solid var(--mt-border);
  }

  .tray-toggle {
    display: block;
    min-height: 44px;
    padding: 8px 16px;
    border: 0;
    background: transparent;
    color: var(--mt-text);
    font: inherit;
    cursor: pointer;
  }

  .workspace-tray {
    padding: 8px 16px 16px;
  }

  .board-viewport {
    flex: none;
    width: 100%;
  }
}

@media (max-height: 500px) and (orientation: landscape) {
  .tabla-playground {
    padding: 4px;
  }

  .board-viewport {
    overflow-x: auto;
  }

  .board-frame {
    max-width: none;
  }

  .board-frame :deep(.unit-number:not(.unit-number--start):not(.unit-number--end)) {
    transform: translateX(-50%);
  }
}
</style>
