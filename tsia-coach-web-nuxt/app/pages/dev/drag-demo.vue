<template>
  <section class="phase-demo">
    <div
      ref="containerEl"
      class="bounds"
    >
      <div
        ref="boxEl"
        class="drag-box"
      />
    </div>
    <p>Phase 0 demo — temporary, removed in Phase 1</p>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Draggable } from 'gsap/Draggable'

const containerEl = ref<HTMLDivElement | null>(null)
const boxEl = ref<HTMLDivElement | null>(null)
const nuxtApp = useNuxtApp()

let draggableInstance: ReturnType<typeof Draggable.create>[number] | null = null

onMounted(() => {
  if (!containerEl.value || !boxEl.value) {
    return
  }

  const { $Draggable } = nuxtApp as unknown as { $Draggable: typeof Draggable }

  draggableInstance = $Draggable.create(boxEl.value, {
    type: 'x,y',
    bounds: containerEl.value,
    inertia: true,
    edgeResistance: 0.85,
  })[0]
})

onBeforeUnmount(() => {
  draggableInstance?.kill()
})
</script>

<style scoped>
.phase-demo {
  display: grid;
  gap: 12px;
  justify-items: start;
  padding: 16px;
}

.bounds {
  width: 600px;
  height: 400px;
  border: 2px solid #1f2937;
  position: relative;
  overflow: hidden;
}

.drag-box {
  width: 80px;
  height: 80px;
  background: #22c55e;
  position: absolute;
  top: 24px;
  left: 24px;
}
</style>
