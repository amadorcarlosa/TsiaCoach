import {
    nextTick,
    onBeforeUnmount,
    onMounted,
    inject,
    watch,
    type Ref,
} from 'vue'
import type { Draggable } from 'gsap/Draggable'
import {
    screenDeltaToGrid,
    type Point,
} from '~/components/grid/gridPointer'
import { sceneCancellationKey } from '~/components/rod/scene/scene-cancellation'

type BoardDragOptions = {
    el: Ref<HTMLElement | null>
    position: () => Point
    cellSize: () => number
    snapToGrid: () => boolean
    enabled?: () => boolean
    onSettled: (position: Point) => void
    onStart?: () => boolean
    onPreview?: (position: Point) => void
    onEnd?: () => void
}

export function useInertialBoardDrag(options: BoardDragOptions) {
    const { $gsap: gsap, $Draggable } = useNuxtApp()

    let draggable: Draggable | null = null
    let proxy: HTMLDivElement | null = null
    let motionPreference: MediaQueryList | null = null

    let active = false
    let cancelling = false
    let disposed = false

    let current: Point = { ...options.position() }
    let startPosition: Point = { ...current }
    let startProxy: Point = { x: 0, y: 0 }

    let axisX: Point = { x: 1, y: 0 }
    let axisY: Point = { x: 0, y: 1 }

    let moving = false
    let moveVersion = 0

    const cancellationVersion = inject(sceneCancellationKey, null)

    function beginMove(): boolean {
        // Re-pressing an ongoing throw retains its captured selection.
        if (moving) return true
        if (options.onStart?.() === false) return false

        moving = true
        moveVersion++
        return true
    }

    function endMove(): void {
        if (!moving) return

        moving = false
        moveVersion++
        options.onEnd?.()
    }

    function isEnabled() {
        return options.enabled?.() ?? true
    }

    function syncInteraction() {
        cancel()

        if (isEnabled()) {
            draggable?.enable()
        } else {
            draggable?.disable()
        }
    }

    function measureAxes(): boolean {
        const world = options.el.value?.closest('[data-grid-world]')

        const read = (name: string) =>
            world
                ?.querySelector(`[data-grid-axis="${name}"]`)
                ?.getBoundingClientRect()

        const origin = read('origin')
        const x = read('x')
        const y = read('y')

        if (!origin || !x || !y) return false

        axisX = {
            x: x.left - origin.left,
            y: x.top - origin.top,
        }

        axisY = {
            x: y.left - origin.left,
            y: y.top - origin.top,
        }

        return screenDeltaToGrid(
            { x: 0, y: 0 },
            axisX,
            axisY,
        ) !== null
    }

    function boardPosition(point: Point): Point {
        const delta = screenDeltaToGrid(
            {
                x: point.x - startProxy.x,
                y: point.y - startProxy.y,
            },
            axisX,
            axisY,
        )

        if (!delta) return { ...startPosition }

        return {
            x: startPosition.x + delta.x,
            y: startPosition.y + delta.y,
        }
    }

    function proxyPosition(position: Point): Point {
        const x = position.x - startPosition.x
        const y = position.y - startPosition.y

        return {
            x: startProxy.x + x * axisX.x + y * axisY.x,
            y: startProxy.y + x * axisX.y + y * axisY.y,
        }
    }

    function snapPosition(position: Point): Point {
        return options.snapToGrid()
            ? {
                x: Math.round(position.x),
                y: Math.round(position.y),
            }
            : position
    }

    function snapProxy(point: Point): Point {
        return proxyPosition(snapPosition(boardPosition(point)))
    }

    function render(position: Point) {
        current = { ...position }

        const element = options.el.value
        if (!element) return

        const committed = options.position()
        const cellSize = options.cellSize()

        void gsap.set(element, {
            x: (current.x - committed.x) * cellSize,
            y: (current.y - committed.y) * cellSize,
        })
    }

    function renderProxy() {
        if (!active || !draggable) return

        const position = boardPosition({
            x: draggable.x,
            y: draggable.y,
        })

        render(position)
        options.onPreview?.(position)
    }

    async function commit(position: Point) {
        if (disposed || cancelling || !moving || !isEnabled()) return

        const version = moveVersion

        render(position)
        options.onPreview?.(position)
        options.onSettled({ ...position })

        await nextTick()

        // An older completion must not end a newer gesture.
        if (disposed || !moving || version !== moveVersion) return

        render(options.position())
        endMove()
    }

    function finish() {
        if (
            disposed ||
            cancelling ||
            !active ||
            !moving ||
            !isEnabled() ||
            !draggable
        ) return

        const destination = snapPosition(boardPosition({
            x: draggable.x,
            y: draggable.y,
        }))

        active = false
        void commit(destination)
    }

    function cancel() {
        if (cancelling) return

        cancelling = true
        active = false

        try {
            // Clear the scene's movement session before stopping the engine.
            // This also invalidates pending commit continuations.
            endMove()

            if (draggable?.isPressed && draggable.pointerEvent) {
                draggable.endDrag(draggable.pointerEvent)
            }

            void draggable?.tween?.kill()

            if (proxy) gsap.killTweensOf(proxy)

            render(options.position())
        } finally {
            cancelling = false
        }
    }

    function onKeydown(event: KeyboardEvent) {
        if (!isEnabled()) return

        if (event.key === 'Escape') {
            event.preventDefault()
            cancel()
            return
        }

        const directions: Record<string, Point> = {
            ArrowLeft: { x: -1, y: 0 },
            ArrowRight: { x: 1, y: 0 },
            ArrowUp: { x: 0, y: -1 },
            ArrowDown: { x: 0, y: 1 },
        }

        const delta = directions[event.key]
        if (!delta) return

        event.preventDefault()
        cancel()

        if (!beginMove()) return

        const position = options.position()

        void commit({
            x: position.x + delta.x,
            y: position.y + delta.y,
        })
    }

    function updateMotionPreference() {
        if (!draggable) return

        draggable.vars.inertia = !motionPreference?.matches

        if (motionPreference?.matches && active) {
            void draggable.tween?.kill()
            finish()
        }
    }

    onMounted(() => {
        const element = options.el.value
        if (!element) return

        current = { ...options.position() }

        proxy = document.createElement('div')
        proxy.setAttribute('aria-hidden', 'true')
        proxy.style.cssText = [
            'position:fixed',
            'left:0',
            'top:0',
            'width:1px',
            'height:1px',
            'visibility:hidden',
            'pointer-events:none',
        ].join(';')

        document.body.appendChild(proxy)

        motionPreference = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        )

        draggable = $Draggable.create(proxy, {
            trigger: element,
            // Let the shared rod menu handle native and keyboard context menus.
            allowContextMenu: true,
            type: 'x,y',
            inertia: !motionPreference.matches,
            minimumMovement: 3,
            maxDuration: 0.35,
            overshootTolerance: 0,
            cursor: 'grab',
            activeCursor: 'grabbing',

            snap: {
                points: snapProxy,
            },

            onPress: function (this: Draggable) {
                if (!isEnabled() || !measureAxes()) {
                    cancel()
                    return
                }
                const event = this.pointerEvent as MouseEvent | PointerEvent | undefined

                if (
                    event &&
                    (
                        ('button' in event && event.button !== 0) ||
                        event.shiftKey ||
                        event.ctrlKey ||
                        event.metaKey
                    )
                ) {
                    cancel()
                    return
                }

                if (!beginMove()) {
                    cancel()
                    return
                }

                startPosition = { ...current }
                startProxy = { x: this.x, y: this.y }
                active = true

                element.focus({ preventScroll: true })
            },

            onDrag: renderProxy,
            onThrowUpdate: renderProxy,
            onThrowComplete: finish,

            onDragEnd: function (this: Draggable) {
                if (!this.isThrowing) finish()
            },

            // Also settles a throw that was interrupted by a press and release.
            onClick: finish,
        })[0] ?? null

        if (!isEnabled()) {
            draggable?.disable()
        }

        element.addEventListener('keydown', onKeydown)
        window.addEventListener('blur', cancel)
        window.addEventListener('pointercancel', cancel)
        motionPreference.addEventListener('change', updateMotionPreference)
    })

    if (cancellationVersion) {
        watch(
            cancellationVersion,
            () => cancel(),
            { flush: 'sync' },
        )
    }

    watch(
        () => [options.position().x, options.position().y],
        () => {
            if (!active) render(options.position())
        },
    )

    watch(
        () => [isEnabled(), options.cellSize()],
        syncInteraction,
        { flush: 'post' },
    )
    onBeforeUnmount(() => {
        disposed = true
        endMove()

        options.el.value?.removeEventListener('keydown', onKeydown)
        window.removeEventListener('blur', cancel)
        window.removeEventListener('pointercancel', cancel)
        motionPreference?.removeEventListener(
            'change',
            updateMotionPreference,
        )

        void draggable?.tween?.kill()
        draggable?.kill()

        if (proxy) {
            gsap.killTweensOf(proxy)
            proxy.remove()
        }
    })

    return { cancel }
}
