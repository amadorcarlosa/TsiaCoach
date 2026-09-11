// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import {
  defineComponent,
  h,
  inject,
  nextTick,
  ref,
  type Ref,
} from 'vue'
import { mount } from '@vue/test-utils'
import type { Point } from '~/components/grid/gridPointer'
import { sceneCancellationKey } from '~/components/rod/scene/scene-cancellation'
import { useRodScene } from '~/composables/useRodScene'
import { useRodPlaygroundInteraction } from '~/composables/useRodPlaygroundInteraction'

type Scene = ReturnType<typeof useRodScene>
type Playground = ReturnType<typeof useRodPlaygroundInteraction>

const CELL = 10
const ORIGIN = { x: 100, y: 100 }
const COLUMNS = 24
const ROWS = 12

function clientRect(left: number, top: number): DOMRect {
  return {
    left,
    top,
    right: left,
    bottom: top,
    width: 0,
    height: 0,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

function client(point: Point) {
  return {
    clientX: ORIGIN.x + point.x * CELL,
    clientY: ORIGIN.y + point.y * CELL,
  }
}

function pointerEvent(
  type: string,
  point: Point,
  init: PointerEventInit = {},
): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    isPrimary: true,
    button: 0,
    ...client(point),
    ...init,
  })
}

function mountHost(options: {
  disabled?: Ref<boolean>
  cancelVersion?: Ref<number>
  onBoardClick?: (point: Point) => void
} = {}) {
  const disabled = options.disabled ?? ref(false)
  const cancelVersion = options.cancelVersion ?? ref(0)

  let scene!: Scene
  let playground!: Playground
  let cancellation!: Readonly<Ref<number>>

  const Probe = defineComponent({
    setup() {
      cancellation = inject(sceneCancellationKey)!
      return () => null
    },
  })

  const Host = defineComponent({
    setup() {
      scene = useRodScene({
        columns: COLUMNS,
        rows: ROWS,
        spawnRows: [4],
        editable: () => !disabled.value,
        allowOrientation: true,
      })
      const viewport = ref<HTMLElement | null>(null)

      playground = useRodPlaygroundInteraction({
        scene,
        viewport,
        disabled: () => disabled.value,
        cancelVersion: () => cancelVersion.value,
        onBoardClick: options.onBoardClick,
      })

      return () => h(
        'div',
        {
          'ref': viewport,
          'data-role': 'viewport',
          'onPointerdownCapture': playground.marquee.onPointerDown,
          'onLostpointercapture': playground.marquee.onLostPointerCapture,
        },
        [
          h(
            'div',
            {
              'data-grid-world': '',
              'data-grid-columns': String(COLUMNS),
              'data-grid-rows': String(ROWS),
            },
            [
              h('i', { 'data-grid-axis': 'origin' }),
              h('i', { 'data-grid-axis': 'x' }),
              h('i', { 'data-grid-axis': 'y' }),
              h('div', { 'data-role': 'empty' }),
              ...scene.trains.value.map(train =>
                h('div', { 'data-piece-id': train.id }),
              ),
              h(Probe),
            ],
          ),
        ],
      )
    },
  })

  const wrapper = mount(Host, { attachTo: document.body })
  const root = wrapper.element as HTMLElement
  const world = root.querySelector<HTMLElement>('[data-grid-world]')!

  const marker = (name: string) =>
    world.querySelector<HTMLElement>(`[data-grid-axis="${name}"]`)!

  marker('origin').getBoundingClientRect = () => clientRect(ORIGIN.x, ORIGIN.y)
  marker('x').getBoundingClientRect = () => clientRect(ORIGIN.x + CELL, ORIGIN.y)
  marker('y').getBoundingClientRect = () => clientRect(ORIGIN.x, ORIGIN.y + CELL)

  const empty = world.querySelector<HTMLElement>('[data-role="empty"]')!

  function rodElement(id: string) {
    return world.querySelector<HTMLElement>(`[data-piece-id="${id}"]`)!
  }

  function down(point: Point, init: PointerEventInit = {}, target: Element = empty) {
    const event = pointerEvent('pointerdown', point, init)
    target.dispatchEvent(event)
    return event
  }

  function move(point: Point, init: PointerEventInit = {}) {
    const event = pointerEvent('pointermove', point, init)
    window.dispatchEvent(event)
    return event
  }

  function up(point: Point, init: PointerEventInit = {}) {
    const event = pointerEvent('pointerup', point, init)
    window.dispatchEvent(event)
    return event
  }

  function cancelPointer(point: Point, init: PointerEventInit = {}) {
    window.dispatchEvent(pointerEvent('pointercancel', point, init))
  }

  function escape() {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }))
  }

  /** Creates two horizontal rods on the spawn row and returns their ids. */
  async function createPair(): Promise<[string, string]> {
    scene.apply([], { type: 'create', value: 3 })
    scene.apply([], { type: 'create', value: 5 })
    await nextTick()

    const [a, b] = scene.trains.value.map(train => train.id)
    return [a!, b!]
  }

  function anchorOf(id: string) {
    return scene.trains.value.find(train => train.id === id)!.anchor
  }

  function selected() {
    return [...scene.selection.value]
  }

  function highlighted() {
    return [...playground.highlightedIds.value]
  }

  return {
    wrapper,
    scene,
    playground,
    marquee: playground.marquee,
    cancellation: () => cancellation.value,
    disabled,
    cancelVersion,
    empty,
    rodElement,
    down,
    move,
    up,
    cancelPointer,
    escape,
    createPair,
    anchorOf,
    selected,
    highlighted,
  }
}

type Host = ReturnType<typeof mountHost>

/** Drags across rod `a` only, starting from the empty row above it. */
function sweepAcross(host: Host, id: string, init: PointerEventInit = {}) {
  const anchor = host.anchorOf(id)
  const start = { x: anchor.x + 0.5, y: anchor.y - 0.5 }
  const end = { x: anchor.x + 1.5, y: anchor.y + 0.5 }

  host.down(start, init)
  host.move(end, init)

  return { start, end }
}

describe('useSceneMarquee selection', () => {
  it('previews hits without committing and commits on release', async () => {
    const host = mountHost()
    const [a, b] = await host.createPair()

    expect(host.selected()).toEqual([])

    const { end } = sweepAcross(host, a)

    expect(host.marquee.active.value).toBe(true)
    expect(host.playground.blocked.value).toBe(true)
    expect(host.marquee.rectangle.value).toEqual({
      x: host.anchorOf(a).x + 0.5,
      y: host.anchorOf(a).y - 0.5,
      width: 1,
      depth: 1,
    })
    expect(host.highlighted()).toEqual([a])
    expect(host.highlighted()).not.toContain(b)

    // The committed selection is untouched during preview.
    expect(host.selected()).toEqual([])

    host.up(end)

    expect(host.marquee.active.value).toBe(false)
    expect(host.marquee.rectangle.value).toBeNull()
    expect(host.marquee.previewIds.value).toBeNull()
    expect(host.playground.blocked.value).toBe(false)
    expect(host.selected()).toEqual([a])
    expect(host.highlighted()).toEqual([a])

    host.wrapper.unmount()
  })

  it('uses the release position even without a final move', async () => {
    const host = mountHost()
    const [a, b] = await host.createPair()
    const anchor = host.anchorOf(a)

    host.down({ x: anchor.x + 0.5, y: anchor.y - 0.5 })
    host.move({ x: anchor.x + 0.5, y: anchor.y - 1.5 })
    expect(host.highlighted()).toEqual([])

    // Release far to the right, crossing both rods.
    host.up({ x: host.anchorOf(b).x + 0.5, y: anchor.y + 0.5 })

    expect(host.selected()).toEqual([a, b])

    host.wrapper.unmount()
  })

  it('clears on a plain empty click and preserves on a modified one', async () => {
    const host = mountHost()
    const [a] = await host.createPair()
    host.scene.select([a])

    const spot = { x: 20, y: 1 }

    host.down(spot, { shiftKey: true })
    host.up(spot, { shiftKey: true })
    expect(host.selected()).toEqual([a])

    host.down(spot, { ctrlKey: true })
    host.up(spot, { ctrlKey: true })
    expect(host.selected()).toEqual([a])

    host.down(spot)
    // A sub-threshold wiggle still counts as a click.
    host.move({ x: spot.x + 0.1, y: spot.y })
    host.up({ x: spot.x + 0.1, y: spot.y })
    expect(host.selected()).toEqual([])

    host.wrapper.unmount()
  })

  it('fires the board-click callback for completed empty-board clicks', async () => {
    const onBoardClick = vi.fn()
    const host = mountHost({ onBoardClick })
    const [a] = await host.createPair()
    host.scene.select([a])

    const plain = { x: 20, y: 1 }
    host.down(plain)
    host.up(plain)

    expect(host.selected()).toEqual([])
    expect(onBoardClick).toHaveBeenCalledWith(plain)

    host.scene.select([a])
    const modified = { x: 21, y: 1 }
    host.down(modified, { shiftKey: true })
    host.up(modified, { shiftKey: true })

    expect(host.selected()).toEqual([a])
    expect(onBoardClick).toHaveBeenLastCalledWith(modified)
    expect(onBoardClick).toHaveBeenCalledTimes(2)

    host.wrapper.unmount()
  })

  it('does not fire the board-click callback for drag, cancellation, or rod presses', async () => {
    const onBoardClick = vi.fn()
    const host = mountHost({ onBoardClick })
    const [a] = await host.createPair()

    const { end } = sweepAcross(host, a)
    host.up(end)
    expect(onBoardClick).not.toHaveBeenCalled()

    const cancelled = { x: 20, y: 1 }
    host.down(cancelled)
    host.cancelPointer(cancelled)
    host.up(cancelled)
    expect(onBoardClick).not.toHaveBeenCalled()

    const escaped = { x: 21, y: 1 }
    host.down(escaped)
    host.escape()
    host.up(escaped)
    expect(onBoardClick).not.toHaveBeenCalled()

    const rod = host.rodElement(a)
    host.down(host.anchorOf(a), {}, rod)
    host.up(host.anchorOf(a))
    expect(onBoardClick).not.toHaveBeenCalled()

    host.wrapper.unmount()
  })

  it('derives toggle previews from the initial selection on every move', async () => {
    const host = mountHost()
    const [a, b] = await host.createPair()
    host.scene.select([a])

    const row = host.anchorOf(a).y
    const start = { x: host.anchorOf(a).x + 0.5, y: row - 0.5 }
    const bx = host.anchorOf(b).x

    host.down(start, { ctrlKey: true })

    // Enter a: removed from the preview.
    host.move({ x: start.x + 1, y: row + 0.5 }, { ctrlKey: true })
    expect(host.highlighted()).toEqual([])

    // Leave a: the preview restores the initial selection.
    host.move({ x: start.x + 1, y: row - 0.25 }, { ctrlKey: true })
    expect(host.highlighted()).toEqual([a])

    // Enter a and b together: a leaves, b joins.
    host.move({ x: bx + 0.5, y: row + 0.5 }, { ctrlKey: true })
    expect(host.highlighted()).toEqual([b])

    // Re-enter a again: it is removed again, not re-added.
    host.move({ x: start.x + 1, y: row + 0.5 }, { ctrlKey: true })
    expect(host.highlighted()).toEqual([])

    // The commit never changed while previewing.
    expect(host.selected()).toEqual([a])

    host.up({ x: bx + 0.5, y: row + 0.5 }, { ctrlKey: true })
    expect(host.selected()).toEqual([b])

    host.wrapper.unmount()
  })

  it('adds to the initial selection with shift', async () => {
    const host = mountHost()
    const [a, b] = await host.createPair()
    host.scene.select([a])

    const { end } = sweepAcross(host, b, { shiftKey: true })
    expect(host.highlighted()).toEqual([a, b])

    host.up(end, { shiftKey: true })
    expect(host.selected()).toEqual([a, b])

    host.wrapper.unmount()
  })

  it('refuses toolbar actions while active', async () => {
    const host = mountHost()
    const [a] = await host.createPair()
    host.scene.select([a])

    const { end } = sweepAcross(host, a)
    expect(host.playground.applySelected({ type: 'delete' })).toEqual({
      allowed: false,
      reason: 'Finish selecting first.',
    })
    expect(host.scene.trains.value).toHaveLength(2)

    host.up(end)
    expect(host.playground.applySelected({ type: 'delete' }).allowed).toBe(true)
    expect(host.scene.trains.value).toHaveLength(1)

    host.wrapper.unmount()
  })

  it('does not start outside the board or on a control', async () => {
    const host = mountHost()
    await host.createPair()

    host.down({ x: -0.5, y: 2 })
    expect(host.marquee.active.value).toBe(false)

    host.down({ x: 2, y: ROWS + 0.5 })
    expect(host.marquee.active.value).toBe(false)

    const button = document.createElement('button')
    host.empty.append(button)
    host.down({ x: 2, y: 2 }, {}, button)
    expect(host.marquee.active.value).toBe(false)

    host.down({ x: 2, y: 2 }, { button: 2 })
    expect(host.marquee.active.value).toBe(false)

    host.wrapper.unmount()
  })
})

describe('useSceneMarquee cancellation', () => {
  async function previewing(host: Host) {
    const [a, b] = await host.createPair()
    host.scene.select([b])

    const { end } = sweepAcross(host, a)
    expect(host.highlighted()).toEqual([a])
    expect(host.selected()).toEqual([b])

    return { a, b, end }
  }

  function expectDiscarded(host: Host, committed: string[]) {
    expect(host.marquee.active.value).toBe(false)
    expect(host.marquee.rectangle.value).toBeNull()
    expect(host.marquee.previewIds.value).toBeNull()
    expect(host.highlighted()).toEqual(committed)
    expect(host.selected()).toEqual(committed)
  }

  it('discards the preview on Escape and ignores the later release', async () => {
    const host = mountHost()
    const { b, end } = await previewing(host)

    host.escape()
    expectDiscarded(host, [b])

    host.up(end)
    expect(host.selected()).toEqual([b])

    host.wrapper.unmount()
  })

  it('discards the preview on pointer cancellation', async () => {
    const host = mountHost()
    const { b, end } = await previewing(host)

    host.cancelPointer(end)
    expectDiscarded(host, [b])

    host.wrapper.unmount()
  })

  it('discards the preview on lost pointer capture', async () => {
    const host = mountHost()
    const { b, end } = await previewing(host)

    host.marquee.onLostPointerCapture(pointerEvent('lostpointercapture', end))
    expectDiscarded(host, [b])

    host.wrapper.unmount()
  })

  it('discards the preview when the tab cancellation version changes', async () => {
    const cancelVersion = ref(0)
    const host = mountHost({ cancelVersion })
    const { b, end } = await previewing(host)

    cancelVersion.value++
    expectDiscarded(host, [b])

    host.up(end)
    expect(host.selected()).toEqual([b])

    host.wrapper.unmount()
  })

  it('discards the preview when editing becomes disabled', async () => {
    const disabled = ref(false)
    const host = mountHost({ disabled })
    const { b, end } = await previewing(host)

    // Entering portrait disables editing synchronously.
    disabled.value = true
    expectDiscarded(host, [b])
    expect(host.playground.blocked.value).toBe(true)

    host.up(end)
    expect(host.selected()).toEqual([b])

    // Nothing starts while disabled.
    host.down({ x: 20, y: 1 })
    expect(host.marquee.active.value).toBe(false)

    host.wrapper.unmount()
  })

  it('discards the preview when the scene changes underneath it', async () => {
    const host = mountHost()
    const { b } = await previewing(host)

    host.scene.apply([], { type: 'create', value: 2 })
    expectDiscarded(host, [b])

    host.wrapper.unmount()
  })

  it('cancels on unmount', async () => {
    const host = mountHost()
    const { end } = await previewing(host)

    host.wrapper.unmount()

    expect(host.marquee.active.value).toBe(false)
    expect(host.marquee.rectangle.value).toBeNull()

    // Window listeners are gone: a late release commits nothing.
    const before = host.selected()
    host.up(end)
    expect(host.selected()).toEqual(before)
  })
})

describe('useSceneMarquee movement hand-off', () => {
  it('cancels an in-flight movement before selection begins', async () => {
    const host = mountHost()
    const [leader, follower] = await host.createPair()
    host.scene.select([leader, follower])

    const { interaction } = host.playground
    expect(interaction.beginMove(leader)).toBe(true)

    const origin = host.anchorOf(leader)
    const target = { x: origin.x + 2, y: origin.y }
    interaction.previewMove(leader, target)
    expect(interaction.previewFor(follower)).toEqual({ x: 2, y: 0 })

    const versionBefore = host.cancellation()
    const trainsBefore = host.scene.trains.value.map(train => ({ ...train.anchor }))

    // The press lands on empty board while the previous gesture coasts.
    host.down({ x: 20, y: 1 })

    expect(interaction.leaderId.value).toBeNull()
    expect(interaction.previewFor(follower)).toBeUndefined()
    expect(host.cancellation()).toBe(versionBefore + 1)
    expect(host.marquee.active.value).toBe(true)

    // A late settle from the cancelled gesture must commit nothing.
    interaction.settleMove(leader, target)
    interaction.endMove(leader)
    expect(host.scene.trains.value.map(train => ({ ...train.anchor })))
      .toEqual(trainsBefore)

    // Movement cannot restart while the marquee is held.
    expect(interaction.beginMove(leader)).toBe(false)

    host.up({ x: 20, y: 1 })
    expect(interaction.beginMove(leader)).toBe(true)

    host.wrapper.unmount()
  })

  it('blocks a second pointer from starting a marquee during a held rod press', async () => {
    const host = mountHost()
    const [a] = await host.createPair()
    const rod = host.rodElement(a)

    const rodPress = vi.fn()
    rod.addEventListener('pointerdown', rodPress)
    const emptyPress = vi.fn()
    host.empty.addEventListener('pointerdown', emptyPress)

    // The rod's own handlers keep the primary press.
    const first = host.down(host.anchorOf(a), { pointerId: 1 }, rod)
    expect(first.defaultPrevented).toBe(false)
    expect(rodPress).toHaveBeenCalledTimes(1)
    expect(host.marquee.active.value).toBe(false)

    const second = host.down({ x: 20, y: 1 }, { pointerId: 2, isPrimary: false })
    expect(second.defaultPrevented).toBe(true)
    expect(emptyPress).not.toHaveBeenCalled()
    expect(host.marquee.active.value).toBe(false)

    // Releasing the rod pointer frees the board again.
    host.up(host.anchorOf(a), { pointerId: 1 })
    host.down({ x: 20, y: 1 }, { pointerId: 1 })
    expect(host.marquee.active.value).toBe(true)

    host.wrapper.unmount()
  })

  it('blocks a second pointer from reaching a rod during a marquee', async () => {
    const host = mountHost()
    const [a, b] = await host.createPair()
    const rod = host.rodElement(b)

    const rodPress = vi.fn()
    rod.addEventListener('pointerdown', rodPress)

    const { end } = sweepAcross(host, a, { pointerId: 1 })
    expect(host.highlighted()).toEqual([a])

    const second = host.down(
      host.anchorOf(b),
      { pointerId: 2, isPrimary: false },
      rod,
    )
    expect(second.defaultPrevented).toBe(true)
    expect(rodPress).not.toHaveBeenCalled()

    // Moves from the other pointer neither extend nor cancel the marquee.
    host.move({ x: host.anchorOf(b).x + 0.5, y: end.y }, { pointerId: 2 })
    expect(host.highlighted()).toEqual([a])
    expect(host.marquee.active.value).toBe(true)

    host.up(host.anchorOf(b), { pointerId: 2 })
    expect(host.marquee.active.value).toBe(true)

    host.up(end, { pointerId: 1 })
    expect(host.selected()).toEqual([a])

    host.wrapper.unmount()
  })
})
