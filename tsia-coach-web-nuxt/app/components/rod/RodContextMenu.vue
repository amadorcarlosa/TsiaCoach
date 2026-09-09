<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ContextMenuItem } from '@nuxt/ui'

import type { DragProps } from './rod.types'
import type { Point } from '~/components/grid/gridPointer'
import type {
  ArrayRodOrientation,
} from './array/array-rod.types'
import DraggableRod from "~/components/rod/movement/DraggableRod.vue";

const props = withDefaults(defineProps<DragProps & {
  allowOrientation?: boolean
  orientation?: ArrayRodOrientation
  visible?: boolean
}>(), {
  disabled: false,
  selected: false,
  snapToGrid: true,
  allowOrientation: false,
  visible: true,
})

const emit = defineEmits<{
  select: []
  settled: [position: Point]
  remove: []
  orient: [orientation: ArrayRodOrientation]
}>()

const rod = ref<InstanceType<typeof DraggableRod> | null>(null)
const menuOpen = ref(false)

function onOpenChange(open: boolean): void {
  menuOpen.value = open

  if (open && !props.disabled) {
    rod.value?.cancelDrag()
    emit('select')
  }
}

function remove(): void {
  if (props.disabled) return

  rod.value?.cancelDrag()
  emit('remove')
}

function orient(orientation: ArrayRodOrientation): void {
  if (props.disabled || !props.allowOrientation) return

  rod.value?.cancelDrag()
  emit('orient', orientation)
}

const items = computed<ContextMenuItem[][]>(() => {
  const groups: ContextMenuItem[][] = []

  if (props.allowOrientation) {
    const orientations: ArrayRodOrientation[] = [
      'horizontal',
      'vertical',
      'tower',
    ]

    groups.push(orientations.map(orientation => ({
      label: orientation[0]!.toUpperCase() + orientation.slice(1),
      type: 'checkbox' as const,
      checked: props.orientation === orientation,
      disabled: props.disabled,
      onSelect: () => orient(orientation),
    })))
  }

  groups.push([{
    label: 'Remove rod',
    color: 'error',
    disabled: props.disabled,
    onSelect: remove,
  }])

  return groups
})

// The key below remounts the menu when editing becomes disabled.
// Reset local open state at the same time.
watch(() => props.disabled, () => {
  menuOpen.value = false
})

function onMenuKeydown(event: KeyboardEvent): void {
  const opensMenu =
      event.key === 'ContextMenu' ||
      (event.shiftKey && event.key === 'F10')

  if (!opensMenu || props.disabled) return

  event.preventDefault()
  event.stopPropagation()

  const element = event.currentTarget as HTMLElement
  const bounds = element.getBoundingClientRect()

  // Route keyboard opening through the same context-menu trigger.
  element.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: bounds.left + bounds.width / 2,
    clientY: bounds.top + bounds.height / 2,
    button: 2,
  }))
}
</script>

<template>
  <UContextMenu
      :key="String(disabled)"
      :items="items"
      :disabled="disabled"
      :portal="true"
      @update:open="onOpenChange"
  >
    <DraggableRod
        v-show="visible"
        ref="rod"
        :id="id"
        :value="value"
        :x="x"
        :y="y"
        :dimensions="dimensions"
        :cell-size="cellSize"
        :snap-to-grid="snapToGrid"
        :selected="selected"
        :disabled="disabled || menuOpen"
        @select="emit('select')"
        @settled="emit('settled', $event)"
        @keydown.capture="onMenuKeydown"
    />
  </UContextMenu>
</template>
