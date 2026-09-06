<script setup lang="ts">
import { computed } from 'vue'
import type { RodProps } from './rod.types'
import { rodStyle } from './rod.types'

const props = defineProps<RodProps>()

const style = computed(() => ({
  ...rodStyle(props.dimensions, props.unitSize),
  '--fill': props.appearance.fill,
  '--ink': props.appearance.ink,
}))
</script>

<template>
  <div class="rod" :style="style">
    <span class="face bottom" />
    <span class="face front" />
    <span class="face back" />
    <span class="face left" />
    <span class="face right" />
    <span class="face top">{{ label }}</span>
  </div>
</template>
<style scoped>
.rod {
  --w: 28px;
  --d: 28px;
  --h: 28px;
  --fill: white;
  --ink: #202020;
  --rod-label-offset: 0px;

  position: relative;
  width: var(--w);
  height: var(--d);
  transform-style: preserve-3d;
  top: var(--rod-label-offset, 0px);
  line-height: 1;
}

.face {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  background: var(--fill);
  border: 1px solid rgb(0 0 0 / 30%);
  transform-origin: 0 0;
}

.bottom,
.top {
  width: var(--w);
  height: var(--d);
}

.top {
  transform: translateZ(var(--h));
  display: grid;
  place-items: center;
  color: var(--ink);
}

.front,
.back {
  width: var(--w);
  height: var(--h);
}

.front {
  transform: translateY(var(--d)) rotateX(90deg);
  filter: brightness(0.85);
}

.back {
  transform: rotateX(90deg);
  filter: brightness(0.85);
}

.left,
.right {
  width: var(--d);
  height: var(--h);
}

.left {
  transform: rotateZ(90deg) rotateX(90deg);
  filter: brightness(0.7);
}

.right {
  transform: translateX(var(--w)) rotateZ(90deg) rotateX(90deg);
  filter: brightness(0.7);
}
</style>