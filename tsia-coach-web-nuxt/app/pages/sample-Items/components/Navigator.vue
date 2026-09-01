<script setup lang="ts">
import type { PracticeItemPrompt } from '#shared/types/sample-items'
import { Styles } from '../design'

defineProps<{
  items: PracticeItemPrompt[]
  selectedItemId: string | null
}>()

const emit = defineEmits<{
  select: [itemId: string]
}>()
</script>

<template>
  <nav
    v-if="items.length > 1"
    :class="Styles.Navigator"
    aria-label="Practice item selection"
  >
    <button
      v-for="(item, index) in items"
      :key="item.id"
      type="button"
      :class="[
        Styles.NavigatorButton,
        item.id === selectedItemId
          ? Styles.NavigatorButtonSelected
          : Styles.NavigatorButtonIdle
      ]"
      :aria-current="item.id === selectedItemId ? 'page' : undefined"
      :data-practice-item-id="item.id"
      @click="emit('select', item.id)"
    >
      Question {{ index + 1 }}
    </button>
  </nav>
</template>
