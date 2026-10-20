<script setup lang="ts">
import CoachPlayground from '~/components/playground/ai/CoachPlayground.vue'
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Coach playground · TSIA Coach', description: 'Experiment with math boards and inspect AI coaching decisions.' })
</script>

<template>
  <CoachPlayground />
</template>
