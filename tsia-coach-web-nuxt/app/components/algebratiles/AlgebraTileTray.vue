<script setup lang="ts">
import { algebraTileTerms, algebraTileSigns, algebraTileAppearance, algebraTileLabel, algebraTileDimensions, type AlgebraTileTerm, type AlgebraTileSign } from './algebra-tile.types'
import AlgebraTileVisual from './AlgebraTileVisual.vue'
import styles from '~/components/rod/tray/rodTray.styles.module.css'
defineProps<{ disabled: boolean }>()
defineEmits<{ choose: [term: AlgebraTileTerm, sign: AlgebraTileSign] }>()
</script>
<template>
  <div :class="[styles.tray, styles.embedded, styles.wrap]" aria-label="Algebra tiles">
    <div v-for="term in algebraTileTerms" :key="term" class="term-pair">
      <button v-for="sign in algebraTileSigns" :key="sign" :class="styles.choice" type="button" :disabled="disabled"
        :aria-label="'Add ' + algebraTileLabel({ term, sign })"
        :title="'Add ' + algebraTileLabel({ term, sign })"
        @click="$emit('choose', term, sign)">
        <span :class="styles.preview" aria-hidden="true">
          <AlgebraTileVisual
            :dimensions="algebraTileDimensions({ term, rotated: false })"
            :unit-size="12"
            :appearance="algebraTileAppearance({ term, sign })"
            :label="algebraTileLabel({ term, sign })"
          />
        </span>
      </button>
    </div>
  </div>
</template>
<style scoped>
.term-pair { display: grid; gap: 4px; }
button:disabled { opacity: .5; cursor: default; }
button { font-size: 12px; }
</style>
