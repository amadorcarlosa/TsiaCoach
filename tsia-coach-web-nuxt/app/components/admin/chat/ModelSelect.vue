<script setup lang="ts">
import type { components } from '~~/server/types/schema'

type Model = components['schemas']['FoundryDeploymentResponse']

const props = withDefaults(defineProps<{
  models: Model[]
  disabled?: boolean
}>(), {
  disabled: false
})

const model = defineModel<string>({ required: true })

const items = computed(() => props.models.map(item => ({
  label: item.displayName,
  value: item.name,
  description: item.vendor,
  icon: 'i-lucide-bot'
})))
</script>

<template>
  <USelectMenu
    v-model="model"
    :items="items"
    value-key="value"
    label-key="label"
    :disabled="disabled || items.length === 0"
    size="sm"
    color="neutral"
    variant="ghost"
    class="min-w-0 max-w-64 flex-1 sm:min-w-48 sm:flex-none"
    aria-label="Agent model"
  />
</template>
