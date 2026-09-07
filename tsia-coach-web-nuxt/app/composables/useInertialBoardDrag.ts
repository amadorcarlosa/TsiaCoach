import {
    nextTick,
    onBeforeUnmount,
    onMounted,
    watch,
    type Ref,
} from 'vue'
import type { Draggable } from 'gsap/Draggable'
import {
    screenDeltaToGrid,
    type Point, 
} from '~/components/grid/gridPointer'

type BoardDragOptions = {
    el: Ref<HTMLElement | null>
    position: () => Point
    cellSize: () => number
    snapToGrid: () => boolean
    enabled?: () => boolean
    onSettled: (position: Point) => void
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

        render(boardPosition({
            x: draggable.x,
            y: draggable.y,
        }))
    }

    async function commit(position: Point) {
        render(position)
        options.onSettled({ ...position })

        // Let Vue update left/top, then reconcile the temporary transform.
        await nextTick()

        if (!disposed) {
            render(current)
        }
    }

    function finish() {
        if (!active || cancelling || !draggable) return

        const destination = snapPosition(boardPosition({
            x: draggable.x,
            y: draggable.y,
        }))

        active = false
        void commit(destination)
    }

    function cancel() {
        cancelling = true
        active = false

        if (draggable?.isPressed && draggable.pointerEvent) {
            draggable.endDrag(draggable.pointerEvent)
        }

        void draggable?.tween?.kill()

        if (proxy) gsap.killTweensOf(proxy)

        render(options.position())
        cancelling = false
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
