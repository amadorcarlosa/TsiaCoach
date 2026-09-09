<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { SceneAction, SceneResult } from './rod.scene.types'
import type {
  SceneMenuAction, SceneMenuChoice,
  SceneMenuRequest,
} from './scene-menu.types'

const props = defineProps<{
  request: SceneMenuRequest | null
  selection: readonly string[]
  choices: readonly SceneMenuChoice[]
  check: (
      ids: readonly string[],
      action: SceneAction,
  ) => SceneResult
}>()

const emit = defineEmits<{
  action: [action: SceneMenuAction]
  close: []
  'restore-focus': []
}>()

let restoreFocus = false

watch(() => props.request, request => {
  if (request) restoreFocus = false
})

function choose(action: SceneMenuAction): void {
  restoreFocus = true
  emit('action', action)
  emit('close')
}

const items = computed<DropdownMenuItem[]>(() => {
  if (!props.request) return []

  return props.choices.map(choice => {
    const result = props.check(props.selection, choice.action)

    return {
      label: choice.label,
      type: choice.checked === undefined ? 'link' : 'checkbox',
      checked: choice.checked,
      disabled: !result.allowed,
      description: result.allowed ? undefined : result.reason,
      onSelect: () => choose(choice.action),
    }
  })
})

const content = computed(() => ({
  reference: {
    getBoundingClientRect: () => {
      const anchor = props.request?.anchor

      return anchor
          ? new DOMRect(
              anchor.x,
              anchor.y,
              anchor.width,
              anchor.height,
          )
          : new DOMRect()
    },
  },
  side: 'bottom' as const,
  align: 'start' as const,
  sideOffset: 6,
  collisionPadding: 8,
  positionStrategy: 'fixed' as const,

  onEscapeKeyDown: () => {
    restoreFocus = true
  },

  onCloseAutoFocus: (event: Event) => {
    // There is no menu trigger for the library to focus.
    event.preventDefault()

    if (restoreFocus) emit('restore-focus')
    restoreFocus = false
  },
}))

function closeForViewportChange(): void {
  if (props.request) emit('close')
}

onMounted(() => {
  // Capture also catches scrolling inside nested containers.
  window.addEventListener('scroll', closeForViewportChange, true)
  window.addEventListener('resize', closeForViewportChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', closeForViewportChange, true)
  window.removeEventListener('resize', closeForViewportChange)
})
</script>

<template>
  <UDropdownMenu
      :open="request !== null"
      :items="items"
      :content="content"
      :modal="false"
      :portal="true"
      @update:open="open => { if (!open) emit('close') }"
  />
</template>