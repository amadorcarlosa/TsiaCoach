<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import BarRodPlayground from '../BarRodPlayground.vue'
import MathTablaPlayground from '../MathTablaPlayground.vue'
import { buildExperiment, defaultInstructions, parseDecision, type BoardCapture, type ExperimentMode } from './experiment'
import { requestAgentTurn, type AgentTurnRequest, type AgentTurnResult } from '~/utils/agent'
import type { JevResult } from '#shared/jev'
import type { components } from '~~/server/types/schema'

type Model = components['schemas']['FoundryDeploymentResponse']
type BoardHandle = { capture: () => BoardCapture, clear: () => unknown }
type Run = { id: number, mode: ExperimentMode, request: AgentTurnRequest, result?: AgentTurnResult, jev?: JevResult, error?: string, elapsed: number }
const { data: models, status: modelsStatus, error: modelsError, refresh: refreshModels } = await useFetch<Model[]>('/api/models', { default: () => [], server: false })
const model = ref('')
watch(models, values => {
  if (!values.some(item => item.name === model.value)) model.value = values[0]?.name ?? ''
}, { immediate: true })
const boardKind = ref<'bar' | 'mathtabla'>('bar')
const barBoard = ref<BoardHandle | null>(null)
const mathBoard = ref<BoardHandle | null>(null)
const currentBoard = computed(() => boardKind.value === 'bar' ? barBoard.value : mathBoard.value)
const task = ref('Build two consecutive odd numbers. Show why their difference is two.')
const studentMessage = ref('What should I try next?')
const instructions = ref(defaultInstructions)
const mode = ref<ExperimentMode>('decision')
const runs = ref<Run[]>([])
const selectedId = ref<number | null>(null)
const selectedRun = computed(() => runs.value.find(run => run.id === selectedId.value))
const decision = computed(() => selectedRun.value?.result && selectedRun.value.mode === 'decision' ? parseDecision(selectedRun.value.result.text) : null)
const sending = ref(false)
const notice = ref('')
const confirmingClear = ref(false)
let nextId = 1
let controller: AbortController | undefined
watch(boardKind, () => { confirmingClear.value = false })
onBeforeUnmount(() => controller?.abort())

function describeError(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data
    if (data && typeof data === 'object' && 'statusMessage' in data && typeof data.statusMessage === 'string') return data.statusMessage
  }
  return error instanceof Error ? error.message : 'The request failed. Try again.'
}

async function runExperiment() {
  if (sending.value || (mode.value === 'coach' && !model.value) || !task.value.trim() || !currentBoard.value) return
  const request = buildExperiment({ model: mode.value === 'decision' ? 'typesafe/jev-1.13' : model.value, instructions: instructions.value, task: task.value.trim(), studentMessage: studentMessage.value.trim(), mode: mode.value, capture: currentBoard.value.capture() })
  const run: Run = { id: nextId++, mode: mode.value, request, elapsed: 0 }
  runs.value = [run, ...runs.value].slice(0, 20)
  selectedId.value = run.id
  sending.value = true
  notice.value = 'Evaluating the captured board…'
  const abort = new AbortController()
  controller = abort
  const started = performance.now()
  try {
    let result: AgentTurnResult
    if (run.mode === 'decision') {
      const jev = await $fetch<JevResult>('/api/decisions', {
        method: 'POST', body: { state: JSON.parse(request.prompt), instructions: request.instructions }, signal: abort.signal,
      })
      run.jev = jev
      result = { text: JSON.stringify(jev.raw, null, 2), model: jev.model, inputTokens: jev.usage?.input_tokens ?? jev.usage?.inputTokens ?? 0, outputTokens: jev.usage?.output_tokens ?? jev.usage?.outputTokens ?? 0 }
    } else result = await requestAgentTurn(request, abort.signal)
    if (abort.signal.aborted) run.error = 'Run cancelled.'
    else run.result = result
  } catch (error) {
    run.error = abort.signal.aborted ? 'Run cancelled.' : describeError(error)
  } finally {
    run.elapsed = Math.round(performance.now() - started)
    runs.value = runs.value.map(item => item.id === run.id ? { ...run } : item)
    sending.value = false
    notice.value = run.error ?? `Run ${run.id} complete.`
    controller = undefined
  }
}

function clearBoard() {
  currentBoard.value?.clear()
  confirmingClear.value = false
  notice.value = 'Board cleared. Previous run snapshots are unchanged.'
}
</script>

<template>
  <div class="coach-lab">
    <header class="lab-heading">
      <div><h1>Coach playground</h1><p>Build something. Test a response. See what the coach sees.</p></div>
      <span class="lab-status">{{ modelsStatus === 'pending' || modelsStatus === 'idle' ? 'Loading models' : modelsError ? 'Models unavailable' : `${models.length} models available` }}</span>
    </header>
    <div class="lab-workspace">
      <section class="lab-board" aria-label="Math workspace">
        <div class="board-toolbar">
          <div class="board-switch" role="group" aria-label="Board type">
            <button :aria-pressed="boardKind === 'bar'" @click="boardKind = 'bar'">Bar rods</button>
            <button :aria-pressed="boardKind === 'mathtabla'" @click="boardKind = 'mathtabla'">MathTabla</button>
          </div>
          <button v-if="!confirmingClear" class="quiet-button" @click="confirmingClear = true">Clear board</button>
          <div v-else class="clear-confirm"><span>Remove all pieces?</span><button class="quiet-button" @click="clearBoard">Confirm clear</button><button class="quiet-button" @click="confirmingClear = false">Keep pieces</button></div>
        </div>
        <div class="task-strip"><label for="lab-task">Task to explore</label><textarea id="lab-task" v-model="task" rows="2" maxlength="2000" /></div>
        <ClientOnly>
          <BarRodPlayground v-show="boardKind === 'bar'" ref="barBoard" :active="boardKind === 'bar'" :show-authoring="false" />
          <MathTablaPlayground v-show="boardKind === 'mathtabla'" ref="mathBoard" :active="boardKind === 'mathtabla'" :show-authoring="false" />
          <template #fallback><p class="board-help">Loading the math board…</p></template>
        </ClientOnly>
        <p class="board-help">Choose rods from the tray, then move and combine them on the board. Each run captures the current arrangement.</p>
      </section>
      <aside class="lab-controls" aria-label="AI experiment controls">
        <h2>Test the coach</h2>
        <p class="control-intro">One board snapshot per run. Change the model or prompt to compare responses.</p>
        <div v-if="modelsError" role="alert" class="lab-error">Could not load models. Check the API connection. <button @click="refreshModels()">Retry models</button></div>
        <p v-else-if="modelsStatus === 'success' && !models.length" role="status">No models configured. Add a model in the API settings.</p>
        <p v-if="mode === 'decision'" class="mode-help"><strong>Jev 1.13 · OpenRouter Decisions API</strong><br>Returns a typed choice and probabilities, not generated prose.</p><label v-if="mode === 'coach'" for="lab-model">Chat model</label>
        <select v-if="mode === 'coach'" id="lab-model" v-model="model" :disabled="sending || !models.length"><option v-for="item in models" :key="item.name" :value="item.name">{{ item.displayName }}</option></select>
        <fieldset :disabled="sending" class="mode-options">
          <legend>Response mode</legend>
          <label><input v-model="mode" type="radio" value="decision"> Structured decision</label>
          <label><input v-model="mode" type="radio" value="coach"> Coaching response</label>
        </fieldset>
        <p class="mode-help">{{ mode === 'decision' ? 'Choose: observe, ask, hint, or demonstrate. Suggestions are never executed.' : 'Ask for a short response a student could read beside the board.' }}</p>
        <label for="lab-student">Student message</label>
        <textarea id="lab-student" v-model="studentMessage" rows="3" maxlength="2000" placeholder="What might the student say?" />
        <details class="prompt-editor"><summary>Coach instructions</summary><label for="lab-instructions">System prompt</label><textarea id="lab-instructions" v-model="instructions" rows="7" maxlength="8000" /><button class="quiet-button" @click="instructions = defaultInstructions">Restore default prompt</button></details>
        <button v-if="!sending" class="run-button" :disabled="(mode === 'coach' && !model) || !task.trim() || !instructions.trim() || !currentBoard" @click="runExperiment">Capture board &amp; run</button>
        <button v-else class="run-button stop-button" @click="controller?.abort()">Cancel run</button>
        <p class="session-note">Runs stay in this page session. Reloading clears them. Decisions use Jev. Coaching responses use your selected chat model.</p>
      </aside>
    </div>
    <p class="run-status" role="status" aria-live="polite">{{ notice }}</p>
    <section class="lab-inspector" aria-label="Run inspector">
      <div class="inspector-heading"><h2>Run inspector</h2><span>{{ runs.length }} / 20 retained runs</span></div>
      <div v-if="!runs.length" class="inspector-empty"><h3>Your board is the test case.</h3><p>Add a few rods and run the coach. Inspect the response, exact input, model, timing, and token usage here.</p></div>
      <div v-else class="inspector-content">
        <nav class="run-list" aria-label="Past runs"><button v-for="run in runs" :key="run.id" :aria-current="selectedId === run.id ? 'true' : undefined" @click="selectedId = run.id"><strong>Run {{ run.id }} <span>{{ run.error ? 'Failed' : run.result ? 'Complete' : 'Running' }}</span></strong><small>{{ run.request.model }}</small></button></nav>
        <article v-if="selectedRun" class="run-detail">
          <div class="run-meta"><span>{{ selectedRun.mode === 'decision' ? 'Structured decision' : 'Coaching response' }}</span><span>{{ selectedRun.elapsed }} ms</span><span v-if="selectedRun.result">{{ selectedRun.result.inputTokens }} input / {{ selectedRun.result.outputTokens }} output tokens</span></div>
          <p v-if="selectedRun.error" role="alert" class="lab-error">{{ selectedRun.error }} Edit your settings or try another run.</p>
          <template v-else-if="selectedRun.result">
            <div v-if="selectedRun.jev" class="decision-result">
              <span class="decision-action">{{ selectedRun.jev.action }}</span>
              <p>Jev selected this intervention. No board action was executed.</p>
              <p>Confidence: {{ selectedRun.jev.confidence === null ? 'Not supplied' : `${(selectedRun.jev.confidence * 100).toFixed(1)}%` }}</p>
              <table v-if="selectedRun.jev.probabilities"><caption>Probability by action</caption><tbody><tr v-for="(probability, action) in selectedRun.jev.probabilities" :key="action"><th scope="row">{{ action }}</th><td>{{ (probability * 100).toFixed(1) }}%</td></tr></tbody></table>
              <small>Confidence is model-reported, not verified accuracy. This explanation is app-authored.</small>
              <details><summary>Exact Jev request</summary><pre>{{ JSON.stringify(selectedRun.jev.request, null, 2) }}</pre></details>
            </div>
            <div v-else-if="decision" class="decision-result"><span class="decision-action">{{ decision.action }}</span><p>{{ decision.message }}</p><small>Valid decision format. Mathematical accuracy has not been verified.</small></div>
            <p v-else-if="selectedRun.mode === 'decision'" class="lab-error">The model did not return the expected decision format. Inspect the raw response below.</p>
            <p v-else class="coach-response">{{ selectedRun.result.text }}</p>
            <details><summary>Raw response</summary><pre>{{ selectedRun.result.text }}</pre></details>
          </template>
          <p v-else>Waiting for the model…</p>
          <details><summary>Captured board and student input</summary><pre>{{ selectedRun.request.prompt }}</pre></details>
          <details><summary>Instructions sent</summary><pre>{{ selectedRun.request.instructions }}</pre></details>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.coach-lab { --lab-blue: #2563a6; --lab-blue-soft: #eaf2fc; color: var(--mt-text); }
.lab-heading { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 24px; }
h1 { font-size: clamp(1.7rem, 3vw, 2.25rem); font-weight: 650; letter-spacing: -.035em; }
h2 { font-size: 1.1rem; font-weight: 650; }
.lab-heading p, .control-intro, .board-help, .session-note, .mode-help { color: var(--mt-text-muted); line-height: 1.6; }
.lab-status { font-size: .8rem; white-space: nowrap; }
.lab-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 330px; align-items: start; border: 1px solid var(--mt-border); border-radius: 14px; overflow: hidden; background: var(--mt-bg-elevated); }
.lab-board { min-width: 0; padding: 16px; }
.board-toolbar { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
.board-switch { display: flex; gap: 4px; padding: 4px; background: var(--mt-surface-2); border-radius: 9px; }
.board-switch button { padding: 8px 14px; border-radius: 6px; font-size: .85rem; }
.board-switch button[aria-pressed=true] { background: var(--lab-blue); color: white; }
button { cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
button:focus-visible, summary:focus-visible, textarea:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid var(--lab-blue); outline-offset: 3px; }
.quiet-button { color: var(--lab-blue); padding: 8px; font-size: .8rem; text-decoration: underline; text-underline-offset: 3px; }
.clear-confirm { display: flex; flex-wrap: wrap; align-items: center; font-size: .8rem; }
.task-strip { margin: 18px 0 10px; padding-left: 14px; border-left: 3px solid var(--lab-blue); }
label, legend { font-size: .8rem; font-weight: 600; }
textarea, select { display: block; width: 100%; max-width: 100%; background: var(--mt-bg); border: 1px solid var(--mt-border); border-radius: 7px; padding: 10px; font: inherit; font-size: .85rem; line-height: 1.5; margin-top: 6px; }
textarea { resize: vertical; }
.task-strip textarea { background: transparent; border-color: transparent; padding: 4px 0; font-size: .95rem; }
.board-help { font-size: .8rem; margin: 10px 8px; }
.lab-controls { min-width: 0; border-left: 1px solid var(--mt-border); padding: 22px; background: var(--mt-surface-2); }
.control-intro { font-size: .8rem; margin: 8px 0 18px; }
.mode-options { display: grid; gap: 9px; margin-top: 20px; }
.mode-options legend { margin-bottom: 10px; }
.mode-options label { display: flex; align-items: center; gap: 8px; font-weight: 400; }
input { accent-color: var(--lab-blue); }
.mode-help { font-size: .75rem; margin: 10px 0 18px; }
details { margin-top: 16px; }
summary { font-size: .8rem; font-weight: 600; cursor: pointer; padding: 8px 0; }
.prompt-editor label { display: block; margin-top: 8px; }
.run-button { width: 100%; margin-top: 20px; padding: 12px; background: var(--lab-blue); color: white; border-radius: 8px; font-size: .85rem; font-weight: 600; }
.stop-button { background: #924521; }
.session-note { font-size: .7rem; margin-top: 12px; }
.run-status { min-height: 28px; padding: 8px 0; font-size: .8rem; }
.lab-inspector { border: 1px solid var(--mt-border); border-radius: 12px; overflow: hidden; }
.inspector-heading { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--mt-border); }
.inspector-heading > span { color: var(--mt-text-muted); font-size: .75rem; }
.inspector-empty { padding: 30px; }
.inspector-empty h3 { font-weight: 600; margin-bottom: 6px; }
.inspector-empty p { color: var(--mt-text-muted); font-size: .85rem; max-width: 65ch; }
.inspector-content { display: grid; grid-template-columns: 230px minmax(0, 1fr); }
.run-list { border-right: 1px solid var(--mt-border); max-height: 500px; overflow: auto; }
.run-list button { text-align: left; display: block; padding: 15px; width: 100%; border-bottom: 1px solid var(--mt-border); }
.run-list button[aria-current=true] { border-left: 3px solid var(--lab-blue); background: var(--mt-surface-2); }
.run-list strong { display: flex; justify-content: space-between; font-size: .8rem; }
.run-list strong span, .run-list small { font-weight: 400; color: var(--mt-text-muted); font-size: .7rem; overflow-wrap: anywhere; }
.run-detail { padding: 22px; min-width: 0; }
.run-meta { display: flex; flex-wrap: wrap; gap: 12px; color: var(--mt-text-muted); font-size: .75rem; margin-bottom: 20px; }
.decision-action { display: inline-block; padding: 4px 12px; border-radius: 5px; background: var(--lab-blue-soft); color: #174575; font-size: .8rem; font-weight: 650; }
.decision-result p, .coach-response { margin: 12px 0; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.decision-result small { color: var(--mt-text-muted); }
.decision-result table { width: min(100%, 360px); margin: 16px 0; font-size: .85rem; }
.decision-result caption { text-align: left; margin-bottom: 8px; font-weight: 600; }
.decision-result th, .decision-result td { padding: 6px 0; border-bottom: 1px solid var(--mt-border); text-align: left; }
.decision-result td { text-align: right; }
pre { background: var(--mt-surface-2); padding: 16px; border-radius: 8px; font-size: .75rem; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 380px; overflow: auto; }
.lab-error { padding: 12px; border-left: 3px solid #c77929; font-size: .85rem; overflow-wrap: anywhere; }
.lab-error button { text-decoration: underline; }
@media (max-width: 1100px) { .lab-workspace { grid-template-columns: minmax(0, 1fr); } .lab-controls { border-left: 0; border-top: 1px solid var(--mt-border); } }
@media (max-width: 600px) { .lab-heading { align-items: start; flex-direction: column; gap: 8px; } .lab-board { padding: 8px; } .inspector-content { grid-template-columns: 1fr; } .run-list { max-height: 160px; border-right: 0; } .run-detail { padding: 14px; } }
</style>
