<template>
  <main class="drag-demo-page">
    <header class="intro">
      <p class="eyebrow">Reusable drag engine · phase 1</p>
      <h1>Place the piece</h1>
      <p class="lede">
        Drag the teal piece into a zone, or use Tab, Enter, and the arrow keys.
      </p>
    </header>

    <section
      ref="boardEl"
      class="drag-board"
      aria-label="Drag and drop test board"
    >
      <div
        ref="zoneAEl"
        class="drop-zone zone-a"
        :class="{ 'is-active': drag.activeZoneId === 'zone-a' }"
        aria-label="Zone A"
      >
        <span class="zone-kicker">Target 01</span>
        <strong>Zone A</strong>
      </div>

      <div
        ref="zoneBEl"
        class="drop-zone zone-b"
        :class="{ 'is-active': drag.activeZoneId === 'zone-b' }"
        aria-label="Zone B"
      >
        <span class="zone-kicker">Target 02</span>
        <strong>Zone B</strong>
      </div>

      <div
        ref="pieceEl"
        class="drag-piece"
        aria-label="Teal piece"
      >
        <span class="piece-mark" aria-hidden="true">+</span>
        <span>Piece</span>
      </div>
    </section>

    <p class="status">
      <span class="status-label">Last event</span>
      <span>{{ statusMessage }}</span>
    </p>

    <div class="sr-only" aria-live="polite">
      {{ announcer.message }}
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const boardEl = ref<HTMLDivElement | null>(null)
const zoneAEl = ref<HTMLDivElement | null>(null)
const zoneBEl = ref<HTMLDivElement | null>(null)
const pieceEl = ref<HTMLDivElement | null>(null)
const statusMessage = ref('ready')

const dropZones = useDropZones(boardEl)
dropZones.registerZone('zone-a', zoneAEl, { accepts: pieceId => pieceId === 'piece-1' })
dropZones.registerZone('zone-b', zoneBEl, { accepts: pieceId => pieceId === 'piece-1' })

const announcer = useDragAnnouncer()
const drag = useDraggablePiece({
  pieceId: 'piece-1',
  el: pieceEl,
  boardEl,
  zones: dropZones,
  onDropped: zoneId => {
    statusMessage.value = `dropped in ${zoneId}`
  },
  onRejected: () => {
    statusMessage.value = 'rejected'
  },
  onPickedUp: () => {
    statusMessage.value = 'picked up piece-1'
  },
  onCancelled: () => {
    statusMessage.value = 'cancelled'
  },
  announce: announcer.announce
})
</script>

<style scoped>
.drag-demo-page {
  width: min(100% - 32px, 900px);
  margin: 0 auto;
  padding: 56px 0 72px;
  color: var(--mt-text);
}

.intro {
  margin-bottom: 28px;
}

.eyebrow,
.zone-kicker,
.status-label {
  color: var(--mt-text-muted);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1 {
  margin: 8px 0 10px;
  font-size: clamp(2rem, 5vw, 3.4rem);
  letter-spacing: -0.05em;
}

.lede {
  max-width: 560px;
  margin: 0;
  color: var(--mt-text-sub);
  font-size: 1.05rem;
}

.drag-board {
  position: relative;
  min-height: 500px;
  overflow: hidden;
  border: 1px solid var(--mt-border-strong);
  border-radius: 24px;
  background-color: var(--mt-bg-elevated);
  background-image:
    linear-gradient(var(--mt-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--mt-grid-line) 1px, transparent 1px);
  background-size: 32px 32px;
  box-shadow: var(--mt-shadow-lg);
}

.drop-zone {
  position: absolute;
  display: grid;
  align-content: center;
  justify-items: center;
  width: 220px;
  height: 150px;
  gap: 8px;
  border: 2px dashed rgb(15 118 110 / 0.38);
  border-radius: 18px;
  background: rgb(20 184 166 / 0.08);
  color: var(--color-primary-800);
  transition: 160ms ease;
}

.drop-zone.is-active {
  border-color: var(--color-primary-600);
  background: rgb(20 184 166 / 0.18);
  box-shadow: 0 0 0 5px rgb(20 184 166 / 0.12);
  transform: translateY(-3px);
}

.zone-a {
  top: 64px;
  left: 64px;
}

.zone-b {
  right: 64px;
  bottom: 64px;
}

.drag-piece {
  position: absolute;
  top: 216px;
  left: calc(50% - 46px);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 92px;
  height: 68px;
  gap: 7px;
  border: 0;
  border-radius: 14px;
  background: var(--color-primary-600);
  color: white;
  cursor: grab;
  font-weight: 700;
  box-shadow: 0 8px 22px rgb(15 23 42 / 0.14);
  user-select: none;
}

.drag-piece:focus-visible {
  outline: 3px solid var(--color-primary-300);
  outline-offset: 4px;
}

.drag-piece:active {
  cursor: grabbing;
}

.piece-mark {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid rgb(255 255 255 / 0.65);
  border-radius: 50%;
  font-size: 1rem;
  line-height: 1;
}

.status {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: baseline;
  margin: 18px 0 0;
  padding: 14px 16px;
  border: 1px solid var(--mt-border);
  border-radius: 12px;
  background: var(--mt-bg-elevated);
  color: var(--mt-text-sub);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 680px) {
  .drag-demo-page {
    width: min(100% - 24px, 900px);
    padding-top: 32px;
  }

  .drag-board {
    min-height: 560px;
  }

  .drop-zone {
    width: 160px;
    height: 124px;
  }

  .zone-a {
    top: 36px;
    left: 24px;
  }

  .zone-b {
    right: 24px;
    bottom: 36px;
  }
}
</style>
