import { computed, onBeforeUnmount, provide, readonly, ref, shallowRef, watch, type DeepReadonly, type Ref } from 'vue'
import { screenDeltaToGrid, type Point } from '~/components/grid/gridPointer'
import { sceneCancellationKey } from '~/components/rod/scene/scene-cancellation'
import { marqueeRect, marqueeSelection, overlaps, type MarqueeRect, type MarqueeMode } from '~/components/rod/scene/scene-marquee'

type Result = { allowed: true } | { allowed: false; reason: string }

export type SelectionMode = 'preserve' | 'replace' | 'toggle'

/** The scene surface every non-rod manipulative (base-ten blocks, algebra tiles) shares. */
export type ManipulativeScene<Piece extends { id: string; anchor: Point }, Action> = {
  selection: Readonly<Ref<ReadonlySet<string>>>
  select: (ids: readonly string[]) => void
  apply: (ids: readonly string[], action: Action | { type: 'move'; delta: Point }) => Result
  constrainMove: (ids: readonly string[], delta: Point) => Point
  pieces: () => readonly DeepReadonly<Piece>[]
}

export type ManipulativeInteractionOptions<Piece extends { id: string; anchor: Point }, Action> = {
  scene: ManipulativeScene<Piece, Action>
  /** Footprint in board cells, used for marquee hits. */
  footprint: (piece: DeepReadonly<Piece>) => { width: number; depth: number }
  /** Board size in cells; marquee points are clamped to it. */
  bounds: () => { columns: number; rows: number }
  /** data-* attribute that marks a piece, e.g. 'data-base-ten-id'. Marquees never start on one. */
  idAttribute: string
  viewport: Ref<HTMLElement | null>
  disabled: () => boolean
  /** Reactive getter; any change cancels gestures synchronously. */
  cancelVersion: () => number
}

/**
 * Selection, group drag, marquee and context menu for a manipulative board.
 * The scene owns the rules; this only turns pointer input into scene calls.
 */
export function useManipulativeInteraction<Piece extends { id: string; anchor: Point }, Action>(
  options: ManipulativeInteractionOptions<Piece, Action>,
) {
  const { scene } = options
  const cancellation = ref(0)
  provide(sceneCancellationKey, readonly(cancellation))

  const menu = shallowRef<{ id: string; x: number; y: number } | null>(null)
  const rectangle = shallowRef<MarqueeRect | null>(null)
  const previewIds = shallowRef<Set<string> | null>(null)
  // `source` pins the scene version the drag started from; a settle against a
  // different version (restore, undo, external change) is ignored.
  const move = shallowRef<{ id: string; ids: string[]; origin: Point; source: readonly unknown[] } | null>(null)
  const delta = shallowRef<Point>({ x: 0, y: 0 })
  let marquee: {
    pointer: number
    element: HTMLElement
    start: Point
    screen: Point
    initial: Set<string>
    mode: MarqueeMode
    moved: boolean
  } | null = null

  const blocked = computed(() => options.disabled() || menu.value !== null || rectangle.value !== null)
  const highlighted = computed<ReadonlySet<string>>(() => previewIds.value ?? scene.selection.value)

  function cancel(): void {
    move.value = null
    delta.value = { x: 0, y: 0 }
    const previous = marquee
    marquee = null
    rectangle.value = null
    previewIds.value = null
    if (previous?.element.hasPointerCapture(previous.pointer)) previous.element.releasePointerCapture(previous.pointer)
    menu.value = null
    cancellation.value++
  }

  function select(id: string, mode: SelectionMode): void {
    if (blocked.value || move.value) return
    const ids = new Set(scene.selection.value)
    if (mode === 'toggle') {
      if (ids.has(id)) ids.delete(id)
      else ids.add(id)
    }
    else if (mode === 'replace' || !ids.has(id)) {
      ids.clear()
      ids.add(id)
    }
    scene.select([...ids])
  }

  function beginMove(id: string): boolean {
    if (blocked.value || move.value) return false
    const pieces = scene.pieces()
    const piece = pieces.find(item => item.id === id)
    if (!piece) return false
    select(id, 'preserve')
    move.value = { id, ids: [...scene.selection.value], origin: { ...piece.anchor }, source: pieces }
    return true
  }

  function constrain(id: string, position: Point): Point {
    const session = move.value
    if (!session || session.id !== id) return position
    const offset = scene.constrainMove(session.ids, { x: position.x - session.origin.x, y: position.y - session.origin.y })
    return { x: session.origin.x + offset.x, y: session.origin.y + offset.y }
  }

  function preview(id: string, position: Point): void {
    const session = move.value
    if (session?.id === id) delta.value = { x: position.x - session.origin.x, y: position.y - session.origin.y }
  }

  function settle(id: string, position: Point): void {
    const session = move.value
    if (session?.id === id && !blocked.value && session.source === scene.pieces()) {
      scene.apply(session.ids, { type: 'move', delta: { x: position.x - session.origin.x, y: position.y - session.origin.y } })
    }
    delta.value = { x: 0, y: 0 }
  }

  function end(id: string): void {
    if (move.value?.id !== id) return
    move.value = null
    delta.value = { x: 0, y: 0 }
  }

  /** The live drag offset for other pieces moving with the dragged one. */
  function previewFor(id: string): Point | undefined {
    const session = move.value
    return session && session.id !== id && session.ids.includes(id) ? delta.value : undefined
  }

  function apply(action: Action): Result {
    const ids = [...scene.selection.value]
    cancel()
    return scene.apply(ids, action)
  }

  function openMenu(id: string, point: Point): void {
    if (options.disabled()) return
    cancel()
    if (!scene.selection.value.has(id)) scene.select([id])
    menu.value = { id, x: point.x, y: point.y }
  }

  function boardPoint(event: PointerEvent): Point | null {
    const world = options.viewport.value?.querySelector('[data-grid-world]')
    const marker = (name: string) => world?.querySelector(`[data-grid-axis="${name}"]`)?.getBoundingClientRect()
    const origin = marker('origin'), x = marker('x'), y = marker('y')
    if (!origin || !x || !y) return null
    const point = screenDeltaToGrid(
      { x: event.clientX - origin.x, y: event.clientY - origin.y },
      { x: x.x - origin.x, y: x.y - origin.y },
      { x: y.x - origin.x, y: y.y - origin.y },
    )
    if (!point) return null
    const { columns, rows } = options.bounds()
    return { x: Math.max(0, Math.min(columns, point.x)), y: Math.max(0, Math.min(rows, point.y)) }
  }

  function pointerDown(event: PointerEvent): void {
    if (
      options.disabled() || event.button !== 0 || !event.isPrimary ||
      !(event.target instanceof Element) ||
      event.target.closest(`[${options.idAttribute}]`) ||
      !event.target.closest('[data-grid-world]')
    ) return
    const start = boardPoint(event)
    if (!start) return
    cancel()
    const element = options.viewport.value!
    marquee = {
      pointer: event.pointerId,
      element,
      start,
      screen: { x: event.clientX, y: event.clientY },
      initial: new Set(scene.selection.value),
      mode: event.ctrlKey || event.metaKey ? 'toggle' : event.shiftKey ? 'add' : 'replace',
      moved: false,
    }
    rectangle.value = marqueeRect(start, start)
    element.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function pointerMove(event: PointerEvent): void {
    if (!marquee || marquee.pointer !== event.pointerId) return
    const point = boardPoint(event)
    if (!point) return
    marquee.moved ||= Math.hypot(event.clientX - marquee.screen.x, event.clientY - marquee.screen.y) > 3
    const area = marqueeRect(marquee.start, point)
    rectangle.value = area
    const hits = scene.pieces()
      .filter(piece => overlaps(area, { ...piece.anchor, ...options.footprint(piece) }))
      .map(piece => piece.id)
    previewIds.value = marqueeSelection(marquee.initial, hits, marquee.mode)
  }

  function pointerUp(event: PointerEvent): void {
    if (!marquee || marquee.pointer !== event.pointerId) return
    // A click without a drag clears a replace selection; add/toggle keep it.
    const ids = marquee.moved
      ? previewIds.value ?? marquee.initial
      : marquee.mode === 'replace' ? new Set<string>() : marquee.initial
    scene.select([...ids])
    cancel()
  }

  watch(() => [options.disabled(), options.cancelVersion()], cancel, { flush: 'sync' })
  onBeforeUnmount(cancel)

  return {
    menu,
    rectangle,
    blocked,
    highlighted,
    cancel,
    select,
    beginMove,
    constrain,
    preview,
    settle,
    end,
    previewFor,
    apply,
    openMenu,
    pointerDown,
    pointerMove,
    pointerUp,
  }
}
