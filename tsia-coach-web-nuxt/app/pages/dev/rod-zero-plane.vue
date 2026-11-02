<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

// Isolated presentation study: no scene arithmetic, persistence or drag behavior.
const tilt = ref(28)
const depth = ref(36)
const seeBelow = ref(true)
const ready = ref(false)
onMounted(() => { ready.value = true })
const selected = ref<'positive' | 'negative'>('negative')
const style = computed(() => ({
  '--tilt': `${tilt.value}deg`,
  '--depth': `${depth.value}px`,
  '--label-offset': `${depth.value * Math.tan(tilt.value * Math.PI / 180)}px`,
}))
</script>

<template>
  <main class="zero-study" :style="style" :data-ready="ready">
    <NuxtLink to="/dev/playground" class="back">Back to playground</NuxtLink>
    <h1>The grid is zero.</h1>
    <p class="intro">Same colour. Same ten cells. Positive above zero; negative below zero.</p>
    <NuxtLink to="/dev/rod-zero-plane-interactive" class="back">Try the interactive board →</NuxtLink>
    <div class="view-controls" role="group" aria-label="Prototype view">
      <label>Tilt <input v-model.number="tilt" aria-label="Board tilt" type="range" min="0" max="65"> <output>{{ tilt }}°</output></label>
      <label>Depth <input v-model.number="depth" aria-label="Rod depth" type="range" min="8" max="36"> <output>{{ depth }} px</output></label>
      <button type="button" @click="tilt = tilt === 0 ? 28 : 0">{{ tilt === 0 ? 'Angled view' : 'Top-down view' }}</button>
      <label class="floor-toggle"><input v-model="seeBelow" type="checkbox"> Transparent inspection view</label>
    </div>

    <div class="scene-window" :class="{ 'see-below': seeBelow }">
      <div class="scene" role="group" aria-label="Tilted grid with a positive ten above zero and a negative ten below zero">
        <!-- Only the floor has a cutout. The rod DOM remains real HTML below/above it. -->
        <div class="grid-floor" aria-hidden="true" />
        <span class="zero-label">Zero plane</span>
        <button
          type="button" class="rod negative" :class="{ selected: selected === 'negative' }"
          aria-label="Negative 10, recessed below the zero plane" :aria-pressed="selected === 'negative'"
          @click="selected = 'negative'"
        >
          <span class="floor" aria-hidden="true"><span class="rod-label">−10</span></span>
          <span class="wall back-wall" aria-hidden="true" />
          <span class="wall front-wall" aria-hidden="true" />
          <span class="wall left-wall" aria-hidden="true" />
          <span class="wall right-wall" aria-hidden="true" />
          <span class="depth-edge edge-back-left" aria-hidden="true" />
          <span class="depth-edge edge-back-right" aria-hidden="true" />
          <span class="depth-edge edge-front-left" aria-hidden="true" />
          <span class="depth-edge edge-front-right" aria-hidden="true" />
          <span class="zero-mesh" aria-hidden="true" />
          <span class="rim" aria-hidden="true" />
        </button>
        <button
          type="button" class="rod positive" :class="{ selected: selected === 'positive' }"
          aria-label="Positive 10, raised above the zero plane" :aria-pressed="selected === 'positive'"
          @click="selected = 'positive'"
        >
          <span class="floor" aria-hidden="true">+10</span>
          <span class="wall back-wall" aria-hidden="true" />
          <span class="wall front-wall" aria-hidden="true" />
          <span class="wall left-wall" aria-hidden="true" />
          <span class="wall right-wall" aria-hidden="true" />
          <span class="rim" aria-hidden="true" />
        </button>
      </div>
    </div>
    <figure class="side-view" aria-labelledby="side-title">
      <figcaption id="side-title">Side view <span>Depth enlarged for clarity. Length shows magnitude.</span></figcaption>
      <div class="section-diagram" role="img" aria-label="Side view: positive ten extends above the zero plane; negative ten extends the same distance below it.">
        <span class="section-positive section-rod" :class="{ active: selected === 'positive' }" aria-hidden="true">+10</span>
        <span class="section-negative section-rod" :class="{ active: selected === 'negative' }" aria-hidden="true">−10</span>
        <span class="section-zero" aria-hidden="true"><span>0 · grid plane</span></span>
        <span class="section-above" aria-hidden="true">Above zero</span>
        <span class="section-below" aria-hidden="true">Below zero</span>
      </div>
    </figure>
    <div class="legend">
      <p><strong>−10</strong> Grid lines cross at zero, above the darker floor. Inner walls show the depth between them.</p>
      <p><strong>+10</strong> The base stays at zero. The label sits on the raised top.</p>
    </div>
    <p class="note">Select either rod to compare its outline. This is a visual prototype; dragging and cancellation are not connected.</p>
  </main>
</template>

<style scoped>
.zero-study {
  --cell: clamp(14px, 3.3vw, 36px);
  --rod: #f18b24;
  --floor: #182333;
  --line: #3e4b5e;
  --accent: #51e0cb;
  max-width: 1100px;
  margin: 24px auto;
  padding: 24px;
  color: var(--ui-text);
}
.back { color: var(--ui-primary); font-size: .9rem; }
h1 { margin-top: 22px; font-size: clamp(28px, 4vw, 42px); font-weight: 650; letter-spacing: -.035em; }
.intro { margin-top: 8px; max-width: 65ch; color: var(--ui-text-muted); }
.view-controls { display: flex; flex-wrap: wrap; gap: 24px; align-items: center; margin-top: 26px; }
.view-controls label { display: flex; align-items: center; gap: 10px; }
input { accent-color: var(--ui-primary); width: 120px; min-height: 44px; }
output { min-width: 48px; font-variant-numeric: tabular-nums; }
.floor-toggle input { width: 18px; min-height: 18px; }
.view-controls button { padding: 10px 16px; border: 1px solid var(--ui-border); border-radius: 8px; min-height: 44px; }
.scene-window { perspective: 1300px; margin-top: 24px; height: clamp(290px, 46vw, 540px); display: grid; place-items: center; background: #0b1220; border-radius: 12px; border: 1px solid #314055; }
.scene { width: calc(24 * var(--cell)); height: calc(12 * var(--cell)); position: relative; transform-style: preserve-3d; transform: rotateX(var(--tilt)); }
.grid-floor {
  position: absolute; inset: 0; background-color: var(--floor);
  background-image: linear-gradient(to right, var(--line) 1px, transparent 1px), linear-gradient(to bottom, var(--line) 1px, transparent 1px);
  background-size: var(--cell) var(--cell);
  border: 1px solid var(--line);
  /* Outer 24x12 plane minus a 10x1 opening at grid coordinate (13,5). */
  clip-path: polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, 54.166667% 41.666667%, 95.833333% 41.666667%, 95.833333% 50%, 54.166667% 50%, 54.166667% 41.666667%);
}
/* A wire grid makes the entire negative bottom visible, even beyond the
   projected opening. Each face retains its true Z position. */
.see-below .grid-floor {
  background-color: transparent;

}
.see-below .negative .floor { border: 1px solid #e9a354; }
.see-below .negative .wall { background: #f18b2412; border: 0; }
.see-below .negative .front-wall { border-bottom: 1px solid #ffbd7680; }
.zero-label { position: absolute; left: calc(16 * var(--cell)); top: calc(1 * var(--cell)); color: #b5c4d8; font-size: 13px; }
.rod { position: absolute; top: calc(5 * var(--cell)); width: calc(10 * var(--cell)); height: var(--cell); border: 0; padding: 0; background: none; transform-style: preserve-3d; cursor: pointer; color: #241501; }
.negative { left: calc(13 * var(--cell)); }
.positive { left: var(--cell); }
.floor { position: absolute; inset: 0; display: grid; place-items: center; background: var(--rod); border: 1px solid #b36315; font-size: clamp(13px, 1.5vw, 19px); font-weight: 650; backface-visibility: visible; }
.positive .floor { transform: translateZ(var(--depth)); }
/* A small annotation sits above the wire lattice, projected toward the floor.
   The lattice itself stays intact, rather than masking away its cell divisions. */
.negative .rod-label {
  color: #fff8eb;
  background: #42230bf2;
  border: 1px solid #efb773;
  border-radius: 4px;
  padding: 2px 8px;
  font-weight: 750;
  line-height: 1.1;
  transform: translateY(var(--label-offset)) translateZ(calc(var(--depth) + 2px));
  pointer-events: none;
}
.negative .floor { transform-style: preserve-3d; }
.negative .floor { transform: translateZ(calc(-1 * var(--depth))); background: #995016; box-shadow: inset 0 3px 5px #361700a0; }
.wall { position: absolute; background: var(--rod); transform-origin: 0 0; pointer-events: none; }
.front-wall, .back-wall { width: 100%; height: var(--depth); left: 0; }
.front-wall { top: 100%; }
.back-wall { top: 0; }
.positive .front-wall, .positive .back-wall { transform: rotateX(90deg); }
.negative .front-wall, .negative .back-wall { transform: rotateX(-90deg); }
.positive .front-wall { background: #b86516; }
.positive .back-wall { background: #dc791b; }
.negative .back-wall { background: linear-gradient(#e49a46, #703508); border-bottom: 1px solid #542700; }
.negative .front-wall { background: linear-gradient(#ffd08a, #b46b25); border-bottom: 1px solid #65320d; }
.left-wall, .right-wall { width: var(--depth); height: 100%; top: 0; }
.left-wall { left: 0; }
.right-wall { left: 100%; }
.positive .left-wall, .positive .right-wall { transform: rotateY(-90deg); background: #b26518; }
.negative .left-wall, .negative .right-wall { transform: rotateY(90deg); background: linear-gradient(to right, #e49a46, #74390f); }
.depth-edge {
  position: absolute;
  width: 1px;
  height: var(--depth);
  background: #ffd29b;
  transform-origin: 0 0;
  transform: rotateX(-90deg);
  pointer-events: none;
}
.edge-back-left { left: 0; top: 0; }
.edge-back-right { left: 100%; top: 0; }
.edge-front-left { left: 0; top: 100%; }
.edge-front-right { left: 100%; top: 100%; }
/* Continue the board lattice at z=0, above the recessed floor. */
.zero-mesh {
  position: absolute;
  inset: 0;
  transform: translateZ(.5px);
  background-image:
    linear-gradient(to right, #b5c4d86b 1px, transparent 1px),
    linear-gradient(to bottom, #b5c4d86b 1px, transparent 1px);
  background-size: var(--cell) var(--cell);
  border-bottom: 1px solid #b5c4d86b;
  pointer-events: none;
}
.rim { position: absolute; inset: 0; border: 2px solid #f8b155; pointer-events: none; }
.positive .rim { transform: translateZ(calc(var(--depth) + 1px)); }
.negative .rim { transform: translateZ(1px); }
.selected .rim { outline: 2px solid var(--accent); outline-offset: 3px; }
.rod:focus-visible .rim { outline: 3px dashed white; outline-offset: 5px; }
.side-view { margin-top: 22px; padding: 18px 22px; border: 1px solid var(--ui-border); border-radius: 10px; }
.side-view figcaption { font-weight: 600; }
.side-view figcaption span { font-weight: 400; color: var(--ui-text-muted); margin-left: 12px; font-size: .875rem; }
.section-diagram { height: 140px; position: relative; margin-top: 12px; }
.section-zero { position: absolute; left: 0; right: 0; top: 50%; border-top: 1px dashed var(--ui-primary); }
.section-zero span { position: absolute; right: 0; top: -23px; color: var(--ui-primary); font-size: .8rem; }
.section-rod { position: absolute; width: 30%; display: grid; place-items: center; color: #241501; background: var(--rod); border: 1px solid #b36315; font-weight: 650; }
.section-positive { left: 8%; bottom: 50%; height: max(24px, var(--depth)); }
.section-negative { left: 49%; top: 50%; height: max(24px, var(--depth)); background: linear-gradient(#f18b2410, #f18b2438); border: 1px solid #f18b2480; border-top: 0; color: var(--ui-text); }
.section-negative::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; border-bottom: 3px solid var(--rod); }
.section-rod.active { outline: 2px solid var(--ui-primary); outline-offset: 3px; }
.section-above, .section-below { position: absolute; left: 0; font-size: .8rem; color: var(--ui-text-muted); }
.section-above { top: 0; }
.section-below { bottom: 0; }
.legend { display: flex; gap: 28px; flex-wrap: wrap; margin-top: 22px; }
.legend p { max-width: 43ch; color: var(--ui-text-muted); }
.legend strong { display: inline-block; color: var(--ui-text); margin-right: 8px; }
.note { margin-top: 16px; font-size: .875rem; color: var(--ui-text-muted); }
@media (max-width: 600px) { .zero-study { padding: 16px; margin-top: 8px; } .view-controls { gap: 10px; } .side-view figcaption span { display: block; margin: 4px 0 0; } .section-zero span { font-size: .7rem; } input { width: 90px; } }
</style>
