<script setup lang="ts">
import type { useLevelFiles } from '~/composables/useLevelFiles'
const props = defineProps<{ files: ReturnType<typeof useLevelFiles>; disabled: boolean }>()
async function select(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await props.files.selectFile(file)
  input.value = ''
}
</script>
<template>
  <section class="level-files" aria-label="Level files">
    <label>Import level<input type="file" accept=".json,application/json" @change="select"></label>
    <button type="button" @click="files.requestExport()">Export level</button>
    <div v-if="files.preview.value" role="group" aria-label="Replace level confirmation">
      <p>{{ files.preview.value.board.kind }} · {{ files.preview.value.stepCount }} steps</p>
      <dl><template v-for="(value, key) in files.preview.value.board.config" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></template></dl>
      <p>Current authoring work and unsaved board changes will be replaced.</p>
      <button type="button" :disabled="disabled" @click="files.confirmImport()">Replace</button>
      <button type="button" @click="files.cancelImport()">Cancel</button>
    </div>
    <div v-if="files.exportQuestion.value === 'dirty'" role="group" aria-label="Export unsaved changes">
      <button type="button" :disabled="disabled" @click="files.requestExport('update')">Update step and export</button>
      <button type="button" @click="files.requestExport('saved-only')">Export saved steps only</button>
      <button type="button" @click="files.requestExport('cancel')">Cancel</button>
    </div>
    <div v-if="files.exportQuestion.value === 'uncaptured'" role="group" aria-label="Capture before export">
      <p>The working board is not included because no steps have been captured.</p>
      <button type="button" :disabled="disabled" @click="files.captureFirst()">Capture first</button>
      <button type="button" @click="files.requestExport('cancel')">Cancel</button>
    </div>
    <p role="status">{{ files.message.value }}</p>
  </section>
</template>
<style scoped>
.level-files { max-width: 1100px; margin: 12px auto; color: var(--mt-text); }
button, input { font: inherit; padding: 8px; margin: 4px; max-width: 100%; color: var(--mt-text); background: var(--mt-bg-elevated); border: 1px solid var(--mt-border); border-radius: 4px; }
dl { display: flex; flex-wrap: wrap; gap: 8px; }
dd { margin: 0 12px 0 0; }
</style>
