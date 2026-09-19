import { computed, nextTick, type Ref } from 'vue'

type Result = { allowed: true } | { allowed: false; reason: string }

type Options<Action> = {
  actions: readonly { label: string; action: Action }[]
  scene: {
    selection: Readonly<Ref<ReadonlySet<string>>>
    check: (ids: readonly string[], action: Action) => Result
  }
  interaction: {
    menu: Readonly<Ref<{ id: string } | null>>
    apply: (action: Action) => unknown
    cancel: () => void
  }
  viewport: Ref<HTMLElement | null>
  // data-* attribute carrying the piece ID, e.g. 'data-base-ten-id'.
  idAttribute: string
  exists: (id: string) => boolean
}

/** Toolbar/menu choices and menu focus restoration shared by the non-rod manipulative playgrounds. */
export function useManipulativeMenu<Action>(options: Options<Action>) {
  const { scene, interaction } = options

  const choices = computed(() => options.actions.map(choice => ({
    ...choice,
    result: scene.check([...scene.selection.value], choice.action),
  })))

  async function closeMenu(action?: Action): Promise<void> {
    const id = interaction.menu.value?.id
    if (action) interaction.apply(action); else interaction.cancel()
    await nextTick()

    // Prefer the piece the menu opened on; it may be gone after delete/exchange.
    const focusId = id && options.exists(id) ? id : [...scene.selection.value][0]
    const target = focusId
      ? options.viewport.value?.querySelector<HTMLElement>(`[${options.idAttribute}="${focusId}"]`)
      : options.viewport.value
    target?.focus({ preventScroll: true })
  }

  return { choices, closeMenu }
}
