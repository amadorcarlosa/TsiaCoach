<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import DraggableRod from '../movement/DraggableRod.vue'
import type { DragProps } from '../rod.types'
import type { Point } from '~/components/grid/gridPointer'
import type { SceneMenuRequest } from './scene-menu.types'

const props = defineProps<DragProps>()

const emit = defineEmits<{
  select: []
  settled: [position: Point]
  'menu-request': [request: SceneMenuRequest]
}>()

const rod = ref<InstanceType<typeof DraggableRod> | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined
let touch: { id: number; x: number; y: number } | null = null

function clearLongPress(): void {
  clearTimeout(timer)
  timer = undefined
  touch = null
}

function requestMenu(element: HTMLElement): void {
  clearLongPress()
  if (props.disabled) return

  // Measure the accepted position after stopping movement.
  rod.value?.cancelDrag()
  const bounds = element.getBoundingClientRect()

  emit('menu-request', {
    trainId: props.id,
    anchor: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    },
  })
}

function onContextMenu(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  requestMenu(event.currentTarget as HTMLElement)
}

function onKeydown(event: KeyboardEvent): void {
  if (
      event.key !== 'ContextMenu' &&
      !(event.shiftKey && event.key === 'F10')
  ) return

  event.preventDefault()
  event.stopPropagation()
  requestMenu(event.currentTarget as HTMLElement)
}

function onPointerDown(event: PointerEvent): void {
  clearLongPress()

  if (
      props.disabled ||
      event.pointerType !== 'touch' ||
      !event.isPrimary
  ) return

  const element = event.currentTarget as HTMLElement
  touch = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  }

  timer = setTimeout(() => requestMenu(element), 550)
}

function onPointerMove(event: PointerEvent): void {
  if (!touch || touch.id !== event.pointerId) return

  if (
      Math.hypot(
          event.clientX - touch.x,
          event.clientY - touch.y,
      ) > 8
  ) {
    clearLongPress()
  }
}

watch(() => props.disabled, disabled => {
  if (disabled) clearLongPress()
})

onBeforeUnmount(clearLongPress)
</script>

<template>
  <DraggableRod
      ref="rod"
      v-bind="props"
      aria-haspopup="menu"
      @select="emit('select')"
      @settled="emit('settled', $event)"
      @contextmenu.capture="onContextMenu"
      @keydown.capture="onKeydown"
      @pointerdown.capture="onPointerDown"
      @pointermove.capture="onPointerMove"
      @pointerup.capture="clearLongPress"
      @pointercancel.capture="clearLongPress"
      @lostpointercapture="clearLongPress"
  />
</template>