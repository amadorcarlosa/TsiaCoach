import { Atom, AtomRegistry, Hydration } from 'effect/reactivity'
import { Schema } from 'effect'
import { useAtomValue } from '@effect/atom-vue'
import {
  customRef,
  hasInjectionContext,
  inject,
  isReactive,
  reactive,
  toRaw,
  toRefs,
  watch,
  type InjectionKey,
  type Ref,
  type ToRefs,
  type UnwrapNestedRefs,
} from 'vue'

export type WorkflowFetch = <A>(url: string, options?: Record<string, unknown>) => Promise<A>
export type WorkflowSnapshot = ReturnType<typeof Hydration.dehydrate>

/** A Nuxt app owns this context: one per SSR request, one per browser app. */
export interface WorkflowContext {
  readonly registry: AtomRegistry.AtomRegistry
  readonly fetch: WorkflowFetch
  readonly features: Map<string, unknown>
  readonly cleanups: Set<() => void>
  readonly signal: AbortSignal
  snapshot(): WorkflowSnapshot
  dispose(): void
}

export const workflowContextKey: InjectionKey<WorkflowContext> = Symbol('tsia-effect-workflows')

export function createWorkflowContext(options: {
  fetch?: WorkflowFetch
  snapshot?: WorkflowSnapshot
} = {}): WorkflowContext {
  const registry = AtomRegistry.make()
  const cleanups = new Set<() => void>()
  const features = new Map<string, unknown>()
  const lifetime = new AbortController()
  if (options.snapshot) Hydration.hydrate(registry, options.snapshot)
  let disposed = false
  return {
    registry,
    cleanups,
    features,
    signal: lifetime.signal,
    fetch: options.fetch ?? ((url, request) => request === undefined ? $fetch(url) : $fetch(url, request)),
    // Nuxt receives plain JSON DTOs, never Vue proxies or a live registry node.
    snapshot: () => JSON.parse(JSON.stringify(Hydration.dehydrate(registry))) as WorkflowSnapshot,
    dispose() {
      if (disposed) return
      disposed = true
      lifetime.abort()
      for (const cleanup of cleanups) cleanup()
      cleanups.clear()
      registry.dispose()
      features.clear()
    },
  }
}

export function useWorkflowContext(): WorkflowContext {
  const context = hasInjectionContext() ? inject(workflowContextKey, null) : null
  if (!context) throw new Error('Effect workflow context is missing. Install the effect-workflows Nuxt plugin.')
  return context
}

export function workflowFeature<A>(context: WorkflowContext, key: string, create: () => A): A {
  if (!context.features.has(key)) context.features.set(key, create())
  return context.features.get(key) as A
}

type FieldAtom = Atom.Writable<unknown>
const fieldAtoms = new WeakMap<object, FieldAtom>()
const fieldOwners = new WeakMap<object, WorkflowContext>()

/**
 * A writable Atom is the state owner. Vue observes the same object graph for
 * template field edits; nested edits publish a new root to Atom subscribers.
 * Only explicitly declared DTO fields are serializable, never pending work.
 */
export function workflowField<A>(context: WorkflowContext, key: string, initial: A): Ref<A> {
  const atom = Atom.make<unknown>(initial).pipe(
    Atom.keepAlive,
    Atom.serializable({ key: `tsia:${key}`, schema: Schema.Unknown }),
  )
  const release = context.registry.mount(atom)
  let stopDeep: (() => void) | undefined
  let triggerVue = () => {}

  const observe = (value: unknown) => {
    stopDeep?.()
    if (!value || typeof value !== 'object') return
    const observed = isReactive(value) ? value : reactive(value)
    if (observed !== value) {
      context.registry.set(atom, observed)
      return
    }
    stopDeep = watch(observed, () => {
      // Preserve child identities (including server projections) while notifying
      // Atom that its mutable Vue-facing graph has changed.
      const raw = toRaw(observed)
      context.registry.set(atom, reactive(Array.isArray(raw) ? [...raw] : { ...raw }))
    }, { deep: true, flush: 'sync' })
  }

  const unsubscribe = context.registry.subscribe(atom, value => {
    observe(value)
    triggerVue()
  })
  observe(context.registry.get(atom))
  const field = customRef<A>((track, trigger) => {
    triggerVue = trigger
    return {
      get() { track(); return context.registry.get(atom) as A },
      set(value) { context.registry.set(atom, value) },
    }
  })
  fieldAtoms.set(field, atom)
  fieldOwners.set(field, context)
  context.cleanups.add(() => { stopDeep?.(); unsubscribe(); release() })
  return field
}

const workflowFields = new WeakMap<object, Record<string, FieldAtom>>()
const workflowOwners = new WeakMap<object, WorkflowContext>()

export function workflowFacade<A extends object>(fields: A): UnwrapNestedRefs<A> {
  const atoms: Record<string, FieldAtom> = {}
  let owner: WorkflowContext | undefined
  for (const [key, value] of Object.entries(fields)) {
    if (value && typeof value === 'object') {
      const atom = fieldAtoms.get(value)
      if (atom) atoms[key] = atom
      owner ??= fieldOwners.get(value)
    }
  }
  const facade = reactive(fields)
  workflowFields.set(facade, atoms)
  if (owner) workflowOwners.set(facade, owner)
  return facade
}

/** Vue components use the official Atom bindings; imperative bridges share the same registry. */
export function workflowToRefs<A extends object>(facade: A): ToRefs<A> {
  const context = useWorkflowContext()
  if (workflowOwners.get(facade) !== context) {
    throw new Error('A workflow cannot be consumed by another Nuxt app registry.')
  }
  const refs = toRefs(facade)
  // Vue stops watchEffect subscriptions during SSR setup. Atom Vue captures the
  // prefetch value in such a subscription, so using it before an awaited
  // callOnce would render the initial state and disagree with the payload.
  // These refs read our retained registry directly at render time instead.
  if (import.meta.server || typeof window === 'undefined') return refs
  for (const [key, atom] of Object.entries(workflowFields.get(facade) ?? {})) {
    ;(refs as Record<string, unknown>)[key] = useAtomValue(() => atom)
  }
  return refs
}
