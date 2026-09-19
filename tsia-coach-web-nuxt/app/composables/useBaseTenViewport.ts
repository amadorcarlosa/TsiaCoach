import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { screenDeltaToGrid } from '~/components/grid/gridPointer'

export function useBaseTenViewport(viewport: Ref<HTMLElement | null>, cancel: () => void, projection: Ref<{ rise: number; side: number }>) {
  const cellSize = ref(36)
  const fitSize = ref(4)
  const phonePortrait = ref(false)
  const panMode = ref(false)
  let query: MediaQueryList | undefined
  let observer: ResizeObserver | undefined
  let fitted = false
  let positioned = false
  let pan: { pointer: number; x: number; y: number; left: number; top: number } | null = null
  const padding = computed(() => `${Math.ceil(projection.value.rise * cellSize.value) + 24}px ${Math.ceil(projection.value.side * cellSize.value) + 24}px 24px ${Math.ceil(projection.value.side * cellSize.value) + 24}px`)
  const origin = () => viewport.value?.querySelector('[data-grid-axis="origin"]')?.getBoundingClientRect()
  watch(projection, async () => {
    const before = origin()
    cancel()
    await nextTick()
    measure()
    await nextTick()
    const after = origin()
    if (!fitted && before && after && viewport.value) {
      viewport.value.scrollTop += after.top - before.top
      viewport.value.scrollLeft += after.left - before.left
    }
    // Keep a newly raised, screen-sized block visible; large towers retain the
    // floor camera and can still be inspected with pan or Fit board.
    const element = viewport.value
    if (!fitted && element) {
      const faces = [...element.querySelectorAll('[data-base-ten-id][aria-pressed="true"] .face')].map(face => face.getBoundingClientRect())
      if (faces.length) {
        const top = Math.min(...faces.map(face => face.top))
        const bottom = Math.max(...faces.map(face => face.bottom))
        const bounds = element.getBoundingClientRect()
        const left = Math.min(...faces.map(face => face.left))
        const right = Math.max(...faces.map(face => face.right))
        if (right - left <= element.clientWidth - 32) {
          element.scrollLeft += left < bounds.left + 16 ? left - bounds.left - 16 : Math.max(0, right - bounds.left - element.clientWidth + 16)
        }
        if (bottom - top <= element.clientHeight - 32) {
          element.scrollTop += top < bounds.top + 16 ? top - bounds.top - 16 : Math.max(0, bottom - bounds.top - element.clientHeight + 16)
        }
      }
    }
  }, { flush: 'pre' })
  async function measure() {
    const element = viewport.value
    phonePortrait.value = query?.matches ?? false
    if (!element || !element.clientWidth || !element.clientHeight) return
    cancel()
    fitSize.value = Math.max(1, Math.min(36, (element.clientWidth - 48) / (120 + projection.value.side * 2), (element.clientHeight - 48) / (120 + projection.value.rise)))
    if (fitted) cellSize.value = fitSize.value
    if (!positioned) {
      positioned = true
      await nextTick()
      const start = origin(), bounds = element.getBoundingClientRect()
      if (start) { element.scrollLeft += start.left - bounds.left - 24; element.scrollTop += start.top - bounds.top - 24 }
    }
  }
  async function zoom(size: number, fit = false) {
    const element = viewport.value
    if (!element) return
    cancel()
    const bounds = element.getBoundingClientRect()
    const center = { x: bounds.left + element.clientWidth / 2, y: bounds.top + element.clientHeight / 2 }
    function axes() {
      const marker = (name: string) => element!.querySelector(`[data-grid-axis="${name}"]`)!.getBoundingClientRect()
      const origin = marker('origin'), x = marker('x'), y = marker('y')
      return { origin, x: { x: x.x - origin.x, y: x.y - origin.y }, y: { x: y.x - origin.x, y: y.y - origin.y } }
    }
    const before = axes()
    const point = screenDeltaToGrid({ x: center.x - before.origin.x, y: center.y - before.origin.y }, before.x, before.y)
    fitted = fit
    cellSize.value = Math.max(fitSize.value, Math.min(36, size))
    await nextTick()
    if (fit) { element.scrollLeft = 0; element.scrollTop = 0 }
    else if (point) {
      const after = axes()
      element.scrollLeft += after.origin.x + point.x * after.x.x + point.y * after.y.x - center.x
      element.scrollTop += after.origin.y + point.x * after.x.y + point.y * after.y.y - center.y
    }
  }
  function togglePan() { cancel(); panMode.value = !panMode.value }
  function pointerDown(event: PointerEvent) {
    if (!(panMode.value || phonePortrait.value) || !event.isPrimary || event.button !== 0) return
    const element = viewport.value!
    cancel()
    pan = { pointer: event.pointerId, x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop }
    element.setPointerCapture(event.pointerId)
    event.preventDefault()
  }
  function pointerMove(event: PointerEvent) {
    if (!pan || pan.pointer !== event.pointerId || !viewport.value) return
    viewport.value.scrollLeft = pan.left + pan.x - event.clientX
    viewport.value.scrollTop = pan.top + pan.y - event.clientY
  }
  function endPan() {
    const previous = pan
    pan = null
    if (previous && viewport.value?.hasPointerCapture(previous.pointer)) viewport.value.releasePointerCapture(previous.pointer)
  }
  onMounted(() => {
    query = window.matchMedia('(max-width: 600px) and (orientation: portrait)')
    query.addEventListener('change', measure)
    observer = new ResizeObserver(measure)
    if (viewport.value) observer.observe(viewport.value)
    window.addEventListener('blur', cancel)
    measure()
  })
  onBeforeUnmount(() => { observer?.disconnect(); query?.removeEventListener('change', measure); window.removeEventListener('blur', cancel); endPan() })
  return { cellSize, fitSize, padding, phonePortrait, panMode, zoom, togglePan, pointerDown, pointerMove, endPan }
}
