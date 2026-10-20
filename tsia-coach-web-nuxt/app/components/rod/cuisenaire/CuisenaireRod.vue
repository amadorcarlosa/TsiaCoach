<script setup lang="ts">
import { computed } from 'vue'
import {type RodProps, rodStyle} from "~/components/rod/rod.types.ts";


const props = withDefaults(defineProps<RodProps>(), {
  presentation: 'raised',
})

const flat = computed(() => props.presentation === 'flat')

const style = computed(() => ({
  // A flat piece has no extrusion to project, so its height resolves to zero
  // and the shared raised-piece lean becomes the identity for it.
  ...rodStyle(
    flat.value ? { ...props.dimensions, height: 0 } : props.dimensions,
    props.unitSize,
  ),
  '--fill': props.appearance.fill,
  '--ink': props.appearance.ink,
}))
</script>

<template>
  <div
    class="rod"
    :class="{ 'rod--flat': flat }"
    :style="style"
    :data-rod-presentation="presentation"
    :data-width-px="dimensions.width * unitSize"
  >
    <template v-if="!flat">
      <span class="face bottom" />
      <span class="face front" />
      <span class="face back" />
      <span class="face left" />
      <span class="face right" />
    </template>
    <!-- The one surface both presentations share: label, hit target, measurement. -->
    <span
      :class="flat ? 'strip' : 'face top'"
      data-rod-surface
    >{{ label }}</span>
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

.face,
.strip {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  background: var(--fill);
  border: 1px solid rgb(0 0 0 / 30%);
  transform-origin: 0 0;
}

.bottom,
.top,
.strip {
  width: var(--w);
  height: var(--d);
}

.top,
.strip {
  display: grid;
  place-items: center;
  color: var(--ink);
}

.top {
  transform: translateZ(var(--h));
}

/* No translateZ at all: the strip is part of the board plane, not above it. */
.strip {
  transform: none;
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
