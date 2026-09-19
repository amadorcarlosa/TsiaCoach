import { computed, onBeforeUnmount, provide, readonly, ref, shallowRef, watch, type Ref } from 'vue'
import { baseTenDimensions } from '~/components/basetenblocks/base10.types'
import { screenDeltaToGrid, type Point } from '~/components/grid/gridPointer'
import { sceneCancellationKey } from '~/components/rod/scene/scene-cancellation'
import { marqueeRect, marqueeSelection, overlaps, type MarqueeRect, type MarqueeMode } from '~/components/rod/scene/scene-marquee'
import type { BaseTenAction, useBaseTenScene } from './useBaseTenScene'

export function useBaseTenInteraction(options: {
  scene: ReturnType<typeof useBaseTenScene>; viewport: Ref<HTMLElement | null>; disabled: () => boolean; cancelVersion: () => number
}) {
  const { scene } = options
  const cancellation = ref(0)
  provide(sceneCancellationKey, readonly(cancellation))
  const menu = shallowRef<{ id: string; x: number; y: number } | null>(null)
  const rectangle = shallowRef<MarqueeRect | null>(null)
  const previewIds = shallowRef<Set<string> | null>(null)
  const move = shallowRef<{ id: string; ids: string[]; origin: Point; source: typeof scene.blocks.value } | null>(null)
  const delta = shallowRef<Point>({ x: 0, y: 0 })
  let marquee: { pointer: number; element: HTMLElement; start: Point; screen: Point; initial: Set<string>; mode: MarqueeMode; moved: boolean } | null = null
  const blocked = computed(() => options.disabled() || menu.value !== null || rectangle.value !== null)
  const highlighted = computed(() => previewIds.value ?? scene.selection.value)
  function cancel() {
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
  function select(id: string, mode: 'preserve' | 'replace' | 'toggle') {
    if (blocked.value || move.value) return
    const ids = new Set(scene.selection.value)
    if (mode === 'toggle') { if (ids.has(id)) ids.delete(id); else ids.add(id) }
    else if (mode === 'replace' || !ids.has(id)) { ids.clear(); ids.add(id) }
    scene.select([...ids])
  }
  function beginMove(id: string) {
    if (blocked.value || move.value) return false
    const block = scene.blocks.value.find(block => block.id === id)
    if (!block) return false
    select(id, 'preserve')
    move.value = { id, ids: [...scene.selection.value], origin: { ...block.anchor }, source: scene.blocks.value }
    return true
  }
  function constrain(id: string, position: Point) {
    const session = move.value
    if (!session || session.id !== id) return position
    const offset = scene.constrainMove(session.ids, { x: position.x - session.origin.x, y: position.y - session.origin.y })
    return { x: session.origin.x + offset.x, y: session.origin.y + offset.y }
  }
  function preview(id: string, position: Point) {
    if (move.value?.id === id) delta.value = { x: position.x - move.value.origin.x, y: position.y - move.value.origin.y }
  }
  function settle(id: string, position: Point) {
    const session = move.value
    if (session?.id === id && !blocked.value && session.source === scene.blocks.value) scene.apply(session.ids, { type: 'move', delta: { x: position.x - session.origin.x, y: position.y - session.origin.y } })
    delta.value = { x: 0, y: 0 }
  }
  function end(id: string) { if (move.value?.id === id) { move.value = null; delta.value = { x: 0, y: 0 } } }
  function previewFor(id: string) { return move.value && move.value.id !== id && move.value.ids.includes(id) ? delta.value : undefined }
  function apply(action: BaseTenAction) {
    const ids = [...scene.selection.value]
    cancel()
    return scene.apply(ids, action)
  }
  function openMenu(id: string, point: Point) {
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
    const point = screenDeltaToGrid({ x: event.clientX - origin.x, y: event.clientY - origin.y }, { x: x.x - origin.x, y: x.y - origin.y }, { x: y.x - origin.x, y: y.y - origin.y })
    return point ? { x: Math.max(0, Math.min(120, point.x)), y: Math.max(0, Math.min(120, point.y)) } : null
  }
  function pointerDown(event: PointerEvent) {
    if (options.disabled() || event.button !== 0 || !event.isPrimary || !(event.target instanceof Element) || event.target.closest('[data-base-ten-id]') || !event.target.closest('[data-grid-world]')) return
    const start = boardPoint(event)
    if (!start) return
    cancel()
    const element = options.viewport.value!
    marquee = { pointer: event.pointerId, element, start, screen: { x: event.clientX, y: event.clientY }, initial: new Set(scene.selection.value), mode: event.ctrlKey || event.metaKey ? 'toggle' : event.shiftKey ? 'add' : 'replace', moved: false }
    rectangle.value = marqueeRect(start, start)
    element.setPointerCapture(event.pointerId)
    event.preventDefault()
  }
  function pointerMove(event: PointerEvent) {
    if (!marquee || marquee.pointer !== event.pointerId) return
    const point = boardPoint(event)
    if (!point) return
    marquee.moved ||= Math.hypot(event.clientX - marquee.screen.x, event.clientY - marquee.screen.y) > 3
    rectangle.value = marqueeRect(marquee.start, point)
    const hits = scene.blocks.value.filter(block => overlaps(rectangle.value!, { ...block.anchor, width: baseTenDimensions(block).width, depth: baseTenDimensions(block).depth })).map(block => block.id)
    previewIds.value = marqueeSelection(marquee.initial, hits, marquee.mode)
  }
  function pointerUp(event: PointerEvent) {
    if (!marquee || marquee.pointer !== event.pointerId) return
    const ids = marquee.moved ? previewIds.value ?? marquee.initial : marquee.mode === 'replace' ? new Set<string>() : marquee.initial
    scene.select([...ids])
    cancel()
  }
  watch(() => [options.disabled(), options.cancelVersion()], cancel, { flush: 'sync' })
  onBeforeUnmount(cancel)
  return { menu, rectangle, blocked, highlighted, cancel, select, beginMove, constrain, preview, settle, end, previewFor, apply, openMenu, pointerDown, pointerMove, pointerUp }
}
