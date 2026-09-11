import {
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type Ref,
} from 'vue'
import {
  screenDeltaToGrid,
  type Point,
} from '~/components/grid/gridPointer'
import {
  marqueeHits,
  marqueeRect,
  marqueeSelection,
  type MarqueeMode,
  type MarqueeRect,
} from '~/components/rod/scene/scene-marquee'
import type { useRodScene } from './useRodScene'

type Options = {
  scene: ReturnType<typeof useRodScene>
  viewport: Ref<HTMLElement | null>
  disabled: () => boolean
  beforeStart: () => void
  onBoardClick?: (point: Point) => void
}

type Session = {
  pointerId: number
  capture: HTMLElement
  world: HTMLElement
  start: Point
  screenStart: Point
  initial: Set<string>
  mode: MarqueeMode
  crossedThreshold: boolean
}

function boardPoint(
  world: HTMLElement,
  event: PointerEvent,
): Point | null {
  const marker = (name: string) =>
    world.querySelector<HTMLElement>(
      `[data-grid-axis="${name}"]`,
    )?.getBoundingClientRect()

  const origin = marker('origin')
  const x = marker('x')
  const y = marker('y')

  if (!origin || !x || !y) return null

  return screenDeltaToGrid(
    {
      x: event.clientX - origin.left,
      y: event.clientY - origin.top,
    },
    {
      x: x.left - origin.left,
      y: x.top - origin.top,
    },
    {
      x: y.left - origin.left,
      y: y.top - origin.top,
    },
  )
}

function clampToBoard(world: HTMLElement, point: Point): Point {
  return {
    x: Math.max(
      0,
      Math.min(Number(world.dataset.gridColumns), point.x),
    ),
    y: Math.max(
      0,
      Math.min(Number(world.dataset.gridRows), point.y),
    ),
  }
}

export function useSceneMarquee(options: Options) {
  const active = ref(false)
  const rectangle = shallowRef<MarqueeRect | null>(null)
  const previewIds = shallowRef<ReadonlySet<string> | null>(null)

  let session: Session | null = null
  let heldPointer: number | null = null

  function cancel(): void {
    const previous = session

    // Clear first: releasing capture may dispatch lostpointercapture.
    session = null
    active.value = false
    rectangle.value = null
    previewIds.value = null

    if (previous) {
      heldPointer = null

      if (previous.capture.hasPointerCapture(previous.pointerId)) {
        previous.capture.releasePointerCapture(previous.pointerId)
      }
    }
  }

  function onPointerDown(event: PointerEvent): void {
    const viewport = options.viewport.value
    const target = event.target

    if (!viewport || !(target instanceof Element)) return

    // Prevent a second pointer from reaching rods during a held gesture.
    if (heldPointer !== null && heldPointer !== event.pointerId) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }

    if (options.disabled() || event.button !== 0) return

    const world = target.closest<HTMLElement>('[data-grid-world]')
    if (!world || !viewport.contains(world)) return

    if (!event.isPrimary) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }

    // Track rod presses too, but leave their existing handlers in charge.
    if (target.closest('[data-piece-id]')) {
      heldPointer = event.pointerId
      return
    }

    if (target.closest(
      'button, a, input, select, textarea, [role="button"],'
      + ' [role="menu"], [contenteditable], [data-marquee-ignore]',
    )) return

    const start = boardPoint(world, event)
    if (!start) return

    const columns = Number(world.dataset.gridColumns)
    const rows = Number(world.dataset.gridRows)

    // Excludes padding and decorations extending outside the board.
    if (
      start.x < 0 || start.y < 0
      || start.x > columns || start.y > rows
    ) return

    // Must synchronously invalidate movement and stop its drag engine.
    options.beforeStart()

    heldPointer = event.pointerId
    session = {
      pointerId: event.pointerId,
      capture: viewport,
      world,
      start,
      screenStart: { x: event.clientX, y: event.clientY },
      initial: new Set(options.scene.selection.value),
      mode: event.ctrlKey || event.metaKey
        ? 'toggle'
        : event.shiftKey ? 'add' : 'replace',
      crossedThreshold: false,
    }

    active.value = true
    previewIds.value = new Set(session.initial)
    viewport.setPointerCapture(event.pointerId)

    event.preventDefault()
    event.stopPropagation()
  }

  function onPointerMove(event: PointerEvent): void {
    const current = session
    if (!current || event.pointerId !== current.pointerId) return

    if (options.disabled()) {
      cancel()
      return
    }

    const point = boardPoint(current.world, event)
    if (!point) {
      cancel()
      return
    }

    if (!current.crossedThreshold) {
      current.crossedThreshold = Math.hypot(
        event.clientX - current.screenStart.x,
        event.clientY - current.screenStart.y,
      ) >= 4
    }

    if (!current.crossedThreshold) return

    rectangle.value = marqueeRect(
      current.start,
      clampToBoard(current.world, point),
    )

    previewIds.value = marqueeSelection(
      current.initial,
      marqueeHits(options.scene.trains.value, rectangle.value),
      current.mode,
    )

    event.preventDefault()
  }

  function onPointerUp(event: PointerEvent): void {
    if (heldPointer === event.pointerId) heldPointer = null
    if (!session || event.pointerId !== session.pointerId) return

    // Include the release position even if no final move event arrived.
    onPointerMove(event)

    const current = session
    if (!current) return

    const next = current.crossedThreshold
      ? [...(previewIds.value ?? current.initial)]
      : current.mode === 'replace' ? [] : [...current.initial]

    const clickPoint = current.crossedThreshold
      ? null
      : { ...current.start }

    cancel()
    options.scene.select(next)

    if (clickPoint) {
      options.onBoardClick?.(clickPoint)
    }
  }

  function onPointerCancel(event: PointerEvent): void {
    if (heldPointer === event.pointerId) heldPointer = null
    if (session?.pointerId === event.pointerId) cancel()
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !session) return
    event.preventDefault()
    event.stopPropagation()
    cancel()
  }

  function onBlur(): void {
    cancel()
    heldPointer = null
  }

  watch(options.disabled, disabled => {
    if (disabled) cancel()
  }, { flush: 'sync' })

  // An external edit/selection change invalidates the captured baseline.
  watch(
    [() => options.scene.trains.value, () => options.scene.selection.value],
    cancel,
    { flush: 'sync' },
  )

  onMounted(() => {
    window.addEventListener('pointermove', onPointerMove, {
      capture: true,
      passive: false,
    })
    window.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('pointercancel', onPointerCancel, true)
    window.addEventListener('keydown', onKeydown, true)
    window.addEventListener('blur', onBlur)
  })

  onBeforeUnmount(() => {
    cancel()
    window.removeEventListener('pointermove', onPointerMove, true)
    window.removeEventListener('pointerup', onPointerUp, true)
    window.removeEventListener('pointercancel', onPointerCancel, true)
    window.removeEventListener('keydown', onKeydown, true)
    window.removeEventListener('blur', onBlur)
  })

  return {
    active,
    rectangle,
    previewIds,
    cancel,
    onPointerDown,
    onLostPointerCapture: onPointerCancel,
  }
}
