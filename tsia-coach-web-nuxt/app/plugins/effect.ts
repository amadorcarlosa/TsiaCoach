import { registryKey } from '@effect/atom-vue'
import { createWorkflowContext, workflowContextKey, type WorkflowSnapshot } from '~/effect/registry'

export default defineNuxtPlugin({
  name: 'effect-workflows',
  enforce: 'pre',
  setup(nuxtApp) {
    const payloadKey = 'effect-workflows'
    const requestFetch = import.meta.server ? useRequestFetch() : $fetch
    const context = createWorkflowContext({
      fetch: (url, options) => requestFetch(url, options),
      snapshot: nuxtApp.payload.state[payloadKey] as WorkflowSnapshot | undefined,
    })
    nuxtApp.vueApp.provide(registryKey, context.registry)
    nuxtApp.vueApp.provide(workflowContextKey, context)
    nuxtApp.vueApp.onUnmount(() => context.dispose())
    if (import.meta.server) {
      nuxtApp.hook('app:rendered', () => {
        nuxtApp.payload.state[payloadKey] = context.snapshot()
        context.dispose()
      })
      nuxtApp.hook('app:error', () => context.dispose())
    }
    if (import.meta.hot) import.meta.hot.dispose(() => context.dispose())
    return { provide: { effectWorkflows: context } }
  },
})
