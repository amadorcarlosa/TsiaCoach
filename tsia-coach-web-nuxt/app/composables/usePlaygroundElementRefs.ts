import type { ComponentPublicInstance, Ref } from 'vue'

function setElementRef(
  target: Ref<HTMLElement | null>,
  element: Element | ComponentPublicInstance | null,
): void {
  target.value =
    element && typeof HTMLElement !== 'undefined' && element instanceof HTMLElement
      ? element
      : null
}

export function usePlaygroundElementRefs() {
  const boardViewport = ref<HTMLElement | null>(null)
  const workspaceTools = ref<HTMLElement | null>(null)

  function setBoardViewport(element: Element | ComponentPublicInstance | null): void {
    setElementRef(boardViewport, element)
  }

  function setWorkspaceTools(element: Element | ComponentPublicInstance | null): void {
    setElementRef(workspaceTools, element)
  }

  return {
    boardViewport,
    workspaceTools,
    setBoardViewport,
    setWorkspaceTools,
  }
}
