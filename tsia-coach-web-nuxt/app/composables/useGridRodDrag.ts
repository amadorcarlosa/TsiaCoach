import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { screenDeltaToGrid, type Point } from '~/components/grid/gridPointer'

export function useGridRodDrag(options: {
  el: Ref<HTMLElement | null>
  position: () => Point
  canDrop: (point: Point) => boolean
  select: () => void
  drop: (point: Point) => void
  rejected: () => void
}) {
  const preview = ref<Point | null>(null)
  const invalid = computed(() => preview.value !== null && !options.canDrop(preview.value))
  let active: { id: number, pointer: Point, origin: Point, axisX: Point, axisY: Point } | null = null

  function cancel() {
    const pointerId = active?.id
    active = null
    preview.value = null
    if (pointerId !== undefined && options.el.value?.hasPointerCapture(pointerId)) options.el.value.releasePointerCapture(pointerId)
  }
  function down(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary || active) return
    const world = options.el.value?.closest('[data-grid-world]')
    const point = (name: string) => world?.querySelector(`[data-grid-axis="${name}"]`)?.getBoundingClientRect()
    const origin = point('origin'), x = point('x'), y = point('y')
    if (!origin || !x || !y) return
    event.preventDefault()
    options.el.value?.focus({ preventScroll: true })
    options.select()
    active = {
      id: event.pointerId, pointer: { x: event.clientX, y: event.clientY }, origin: { ...options.position() },
      axisX: { x: x.x - origin.x, y: x.y - origin.y }, axisY: { x: y.x - origin.x, y: y.y - origin.y },
    }
    options.el.value?.setPointerCapture(event.pointerId)
  }
  function move(event: PointerEvent) {
    if (!active || active.id !== event.pointerId) return
    const delta = { x: event.clientX - active.pointer.x, y: event.clientY - active.pointer.y }
    if (!preview.value && Math.hypot(delta.x, delta.y) < 3) return
    const grid = screenDeltaToGrid(delta, active.axisX, active.axisY)
    if (grid) preview.value = { x: active.origin.x + Math.round(grid.x), y: active.origin.y + Math.round(grid.y) }
  }
  function up(event: PointerEvent) {
    if (!active || active.id !== event.pointerId) return
    move(event)
    const destination = preview.value
    cancel()
    if (!destination) return
    if (options.canDrop(destination)) options.drop(destination)
    else options.rejected()
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); cancel(); return }
    if (active) return
    const directions: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }
    const delta = directions[event.key]
    if (!delta) return
    event.preventDefault()
    options.select()
    const origin = options.position()
    const destination = { x: origin.x + delta.x, y: origin.y + delta.y }
    if (options.canDrop(destination)) options.drop(destination)
    else options.rejected()
  }
  onMounted(() => window.addEventListener('blur', cancel))
  onBeforeUnmount(() => { cancel(); window.removeEventListener('blur', cancel) })
  return { preview, invalid, down, move, up, cancel, keydown }
}
