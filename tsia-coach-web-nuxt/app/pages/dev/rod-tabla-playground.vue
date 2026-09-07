<script setup lang="ts">
import RodTabla from '~/components/tabla/RodTabla.vue'
import { getTablaGeometry } from '~/components/tabla/tabla.geometry'
import {
  type CuisenaireRodValue,
  CuisenaireRodValues,

  getRodDefinition
} from '~/components/rod/rod.types'
import DraggableRod from '~/components/rod/DraggableRod.vue'
import type { Point } from '~/components/grid/gridPointer'

const compactLayout = ref(false)
const trayOpen = ref(false)

let layoutQueries: MediaQueryList[] = []

function updateLayout() {
  const [compact, phone, short] = layoutQueries
  if (!compact || !phone || !short) return

  compactLayout.value = compact.matches || short.matches

  // Open initially on small laptops.
  // Collapse initially on phones and short landscape viewports.
  trayOpen.value = !phone.matches && !short.matches
}

onMounted(() => {
  layoutQueries = [
    window.matchMedia('(max-width: 1119px)'),
    window.matchMedia('(max-width: 600px)'),
    window.matchMedia('(max-height: 500px)'),
  ]

  updateLayout()

  layoutQueries.forEach(query => {
    query.addEventListener('change', updateLayout)
  })
})

onBeforeUnmount(() => {
  layoutQueries.forEach(query => {
    query.removeEventListener('change', updateLayout)
  })
})
const targetCount = 3
const geometry = getTablaGeometry(targetCount)
const workspaceStyle = {
  '--grid-top-inset': `${geometry.topInset}px`,
}
const rods = Object.values(CuisenaireRodValues).map(getRodDefinition)
const rod = ref({
  id: 'rod-1',
  value: 6 as CuisenaireRodValue,
  x: 0,
  y: geometry.targets[0]!.row,
})
function settleRod(position: Point) {
  rod.value = {
    ...rod.value,
    ...position,
  }
}
</script>

<template>
  <div class="tabla-playground">
    <div class="workspace" :style="workspaceStyle">
      <div class="workspace-tools">
        <button
            type="button"
            class="tray-toggle"
            :aria-expanded="trayOpen"
            aria-controls="tabla-rod-tray"
            @click="trayOpen = !trayOpen"
        >
          {{ trayOpen ? 'Hide rods' : 'Show rods' }}
        </button>

        <div
            id="tabla-rod-tray"
            v-show="!compactLayout || trayOpen"
            class="workspace-tray"
        >
          <RodTray
              :items="rods"
              :unit-size="16"
              :layout="compactLayout ? 'wrap' : 'vertical'"
              embedded
          />
        </div>
      </div>

      <div
          class="board-scroll"
          role="region"
          aria-label="Rod board, horizontally scrollable"
          tabindex="0"
      >
        <RodTabla
            :target-count="targetCount"
            viewport-padding="var(--workspace-padding-y) 16px"
            embedded
        >
          <template #pieces="{ cellSize }">
            <DraggableRod
                :id="rod.id"
                :value="rod.value"
                :x="rod.x"
                :y="rod.y"
                :cell-size="cellSize"
                :snap-to-grid="true"
                @settled="settleRod"
            />
          </template>
        </RodTabla>
      </div> <p class="position-status" role="status">
      Rod position:
      {{ rod.x.toFixed(2) }}, {{ rod.y.toFixed(2) }}
    </p>
    </div>

   
  </div>
</template>

<style scoped>
.tabla-playground {
  min-width:0;
  padding: 8px;
  display: flex;
  justify-content: center;
}


.workspace {
  --grid-top-inset: 0px;
  --workspace-padding-y: 24px;

  display: flex;
  align-items: stretch;
  gap: 0;
  width: fit-content;
  max-width: 100%;
  margin-inline: auto;
  padding: 0;
  
  background: var(--mt-bg-elevated);
  color: var(--mt-text);
  border: 1px solid var(--mt-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
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

.board-scroll {
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  border-radius: 0 var(--radius-xl) var(--radius-xl) 0;
}

.board-scroll:focus-visible,
.tray-toggle:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: -3px;
}

.position-status {
  margin-top: 8px;
  color: var(--mt-text-muted);
}

/* Compact layout: tray above the board. */
@media (max-width: 1119px), (max-height: 500px) {
  .workspace {
    flex-direction: column;
    width: 100%;
  }

  .workspace-tools {
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

  .board-scroll {
    flex: none;
    width: 100%;
    border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  }
}

@media (max-width: 600px) {
  .tabla-playground {
    padding: 8px;
  }
}

/* Landscape phone: spend less height on surrounding padding. */
@media (max-height: 500px) {
  .tabla-playground {
    padding: 8px;
  }

  .workspace {
    --workspace-padding-y: 8px;
  }
}
</style>
