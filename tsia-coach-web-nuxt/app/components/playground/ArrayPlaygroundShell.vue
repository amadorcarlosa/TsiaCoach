<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import PlaygroundActionButton from '~/components/playground/PlaygroundActionButton.vue'
import PlaygroundRodTray from '~/components/playground/PlaygroundRodTray.vue'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import type { ArrayRodOrientation } from '~/components/rod/array/array-rod.types'
import type { RodSign } from '~/components/rod/scene/rod.scene.types'

withDefaults(defineProps<{
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
  navigable?: boolean
  panMode?: boolean
  selectedOrientation?: ArrayRodOrientation
  setBoardViewport: (element: Element | ComponentPublicInstance | null) => void
  setWorkspaceTools: (element: Element | ComponentPublicInstance | null) => void
  toolbarLabel: string
  trayId: string
  trayOpen: boolean
  viewportClass: string
  /** Present only on boards that accept negative rods; omitting it hides the toggle. */
  rodSign?: RodSign
  /** Board-level readout beside the object count, e.g. a signed total. */
  totalReadout?: string
}>(), {
  selectedOrientation: undefined,
  rodSign: undefined,
  totalReadout: undefined,
})

const emit = defineEmits<{
  boardPointerMove: [event: PointerEvent]
  boardPointerEnd: [event: PointerEvent]
  boardKeydown: [event: KeyboardEvent]
  boardScroll: []
  boardLostPointerCapture: [event: PointerEvent]
  boardPointerDown: [event: PointerEvent]
  chooseRod: [value: CuisenaireRodValue]
  orient: [orientation: ArrayRodOrientation]
  removeSelected: []
  updateTrayOpen: [value: boolean]
  updateRodSign: [sign: RodSign]
}>()
</script>

<template>
  <div class="array-shell">
    <p
      v-if="phonePortrait"
      role="status"
    >
      {{ previewNotice }}
    </p>

    <div :ref="setWorkspaceTools">
      <slot name="tools-start" />

      <div
        class="array-shell-toolbar"
        role="toolbar"
        :aria-label="toolbarLabel"
      >
        <button
          type="button"
          :aria-expanded="trayOpen"
          :aria-controls="trayId"
          @click="emit('updateTrayOpen', !trayOpen)"
        >
          {{ trayOpen ? 'Hide rods' : 'Show rods' }}
        </button>

        <!-- A toggle, so the chosen sign is announced before anything is created. -->
        <PlaygroundActionButton
          v-if="rodSign !== undefined"
          :pressed="rodSign === -1"
          @click="emit('updateRodSign', rodSign === -1 ? 1 : -1)"
        >
          Negative rods
        </PlaygroundActionButton>

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

      <div
        v-show="trayOpen"
        :id="trayId"
      >
        <p
          v-if="rodSign !== undefined"
          class="array-shell-sign"
        >
          New rods: {{ rodSign === -1 ? 'negative' : 'positive' }}
        </p>
        <PlaygroundRodTray
          layout="wrap"
          :sign="rodSign ?? 1"
          :disabled="blocked"
          @choose="emit('chooseRod', $event)"
        />
      </div>
    </div>

    <slot name="before-board" />

    <!-- The viewport handles keyboard panning only when it itself has focus. -->
    <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
    <div
      :ref="setBoardViewport"
      class="array-shell-viewport"
      :class="[viewportClass, {
        'marquee-enabled': !editingDisabled,
        'array-shell-viewport--navigable': navigable,
        'array-shell-viewport--panning': panMode,
        'array-shell-viewport--scrollable': scrollable && !phonePortrait,
        'array-shell-viewport--clipped': scrollable && phonePortrait,
      }]"
      :tabindex="navigable ? 0 : -1"
      :role="navigable ? 'region' : undefined"
      :aria-label="navigable ? 'Board workspace. Use arrow keys to pan.' : undefined"
      @pointermove="emit('boardPointerMove', $event)"
      @pointerup="emit('boardPointerEnd', $event)"
      @pointercancel="emit('boardPointerEnd', $event)"
      @keydown="emit('boardKeydown', $event)"
      @scroll="emit('boardScroll')"
      @pointerdown.capture="emit('boardPointerDown', $event)"
      @lostpointercapture="emit('boardLostPointerCapture', $event)"
    >
      <slot name="board" />
    </div>

    <slot name="menu" />

    <slot name="after-workspace" />

    <p
      role="status"
      aria-live="polite"
    >
      {{ message }}
    </p>
    <p>
      {{ pieceCount }} {{ pieceCount === 1 ? 'object' : 'objects' }} on the board<template v-if="totalReadout">
        · {{ totalReadout }}
      </template>
    </p>
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

.array-shell-sign {
  margin: 0;
  padding-block: 4px;
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

.array-shell-viewport--navigable { height: min(60vh, 560px); min-height: 240px; overflow: auto; overscroll-behavior: contain; position: relative; border: 1px solid var(--mt-border); border-radius: var(--radius-md); touch-action: none; }
.array-shell-viewport--navigable:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
.array-shell-viewport--panning { cursor: grab; }
.array-shell-viewport--panning :deep(*) { cursor: inherit; }
</style>
