import { useSampleItemsStore } from '~/pages/sample-Items/sample-items'
import type { FocusTargetCommand } from '~/pages/sample-Items/sample-items-ui'

export interface PracticeItemAgentBridge {
  focusTarget: (command: FocusTargetCommand) => void
  clearFocus: () => void
}

declare global {
  interface Window {
    __TSIA_COACH__: PracticeItemAgentBridge
  }
}

export default defineNuxtPlugin({
  name: 'practice-item-agent',
  dependsOn: ['effect-workflows'],
  setup(nuxtApp) {
    const store = useSampleItemsStore(nuxtApp.$effectWorkflows)

    window.__TSIA_COACH__ = {
      focusTarget(command) {
        void store.focusForItem(command)
      },
      clearFocus() {
        store.clearFocus()
      },
    }
  },
})
