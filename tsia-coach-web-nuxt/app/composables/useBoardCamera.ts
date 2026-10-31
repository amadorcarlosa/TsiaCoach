import { clientPointToGrid, gridPointToClient, measureGridFrame } from '~/components/grid/grid-coordinates'
import { computed, nextTick, onBeforeUnmount, ref, type Ref } from 'vue'

/** A DOM board camera. Zoom changes cell size, so geometry and input share one scale.
 * Native scrolling supplies pan; mathematical coordinates never change.
 */
export function useBoardCamera(options: {
  viewport: Ref<HTMLElement | null>
  baseCellSize: () => number
  disabled: () => boolean
  beforeChange: () => void
}) {
  const zoom = ref(1)
  const panMode = ref(false)
  const cellSize = computed(() => options.baseCellSize() * zoom.value)
  let session: { id: number; element: HTMLElement; x: number; y: number; left: number; top: number } | null = null
  let version = 0

  function endPan() {
    const previous = session
    session = null
    if (previous?.element.hasPointerCapture(previous.id)) previous.element.releasePointerCapture(previous.id)
  }

  async function setZoom(value: number) {
    if (options.disabled() || !Number.isFinite(value)) return
    const next = Math.max(0.25, Math.min(2, Math.round(value * 100) / 100))
    if (next === zoom.value) return
    options.beforeChange()
    endPan()
    const element = options.viewport.value
    const world = element?.querySelector<HTMLElement>('[data-grid-world]')
    const frame = world ? measureGridFrame(world) : null
    const rect = element?.getBoundingClientRect()
    const anchor = element && frame && rect ? clientPointToGrid({
      x: rect.left + element.clientWidth / 2,
      y: rect.top + element.clientHeight / 2,
    }, frame) : null
    const currentVersion = ++version
    zoom.value = next
    await nextTick()
    if (currentVersion !== version || !element || !anchor || !world) return
    const updated = measureGridFrame(world)
    if (!updated) return
    const moved = gridPointToClient(anchor, updated)
    const viewport = element.getBoundingClientRect()
    element.scrollLeft += moved.x - viewport.left - element.clientWidth / 2
    element.scrollTop += moved.y - viewport.top - element.clientHeight / 2
  }

  async function reset() {
    if (options.disabled()) return
    await setZoom(1)
    options.beforeChange()
    endPan()
    panMode.value = false
    options.viewport.value?.scrollTo({ left: 0, top: 0, behavior: 'instant' })
  }

  function togglePan() {
    if (options.disabled()) return
    options.beforeChange()
    endPan()
    panMode.value = !panMode.value
  }

  function onPointerDown(event: PointerEvent): boolean {
    if (options.disabled() || (!panMode.value && event.button !== 1)) return false
    if (event.button !== 0 && event.button !== 1) return false
    event.preventDefault()
    event.stopImmediatePropagation()
    if (session) return true
    const element = options.viewport.value
    if (!element) return false
    options.beforeChange()
    element.focus({ preventScroll: true })
    session = { id: event.pointerId, element, x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop }
    element.setPointerCapture(event.pointerId)
    return true
  }

  function onPointerMove(event: PointerEvent) {
    if (!session || session.id !== event.pointerId) return
    session.element.scrollLeft = session.left + session.x - event.clientX
    session.element.scrollTop = session.top + session.y - event.clientY
  }

  function onPointerEnd(event: PointerEvent) {
    if (session?.id === event.pointerId) endPan()
  }

  function onKeydown(event: KeyboardEvent) {
    const element = options.viewport.value
    if (event.target !== element || options.disabled()) return
    const delta = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] }[event.key]
    if (delta) {
      event.preventDefault()
      options.beforeChange()
      element?.scrollBy({ left: delta[0], top: delta[1], behavior: 'instant' })
    } else if (event.key === 'Escape') {
      endPan()
      panMode.value = false
    }
  }

  onBeforeUnmount(endPan)
  return { zoom, cellSize, panMode, setZoom, reset, togglePan, onPointerDown, onPointerMove, onPointerEnd, onKeydown, endPan }
}
