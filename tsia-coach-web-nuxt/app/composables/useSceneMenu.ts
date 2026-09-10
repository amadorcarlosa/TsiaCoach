import {
    computed,
    nextTick,
    onDeactivated,
    readonly,
    shallowRef,
    watch,
    type Ref,
} from 'vue'
import type { useRodScene } from './useRodScene'
import type {
    SceneMenuAction,
    SceneMenuRequest,
} from '~/components/rod/scene/scene-menu.types'

type RodScene = ReturnType<typeof useRodScene>

export function useSceneMenu(options: {
    scene: RodScene
    viewport: Ref<HTMLElement | null>
    disabled: () => boolean
}) {
    const { scene } = options
    const request = shallowRef<SceneMenuRequest | null>(null)
    const selectedIds = computed(() => [...scene.selection.value])

    let returnFocusId: string | null = null

    function close(): void {
        request.value = null
    }

    function selectTrain(id: string): void {
        if (options.disabled() || request.value) return

        // Pointerdown and focus must preserve an existing selection.
        if (!scene.selection.value.has(id)) {
            scene.select([id])
        }
    }

    function open(nextRequest: SceneMenuRequest): void {
        if (options.disabled()) return

        const exists = scene.trains.value.some(
            train => train.id === nextRequest.trainId,
        )
        if (!exists) return

        if (!scene.selection.value.has(nextRequest.trainId)) {
            scene.select([nextRequest.trainId])
        }

        returnFocusId = nextRequest.trainId
        request.value = nextRequest
    }

    function applyAction(action: SceneMenuAction): void {
        if (!request.value || options.disabled()) {
            close()
            return
        }

        const result = scene.apply([...scene.selection.value], action)

        if (
            result.allowed &&
            (
                action.type === 'make-train' ||
                action.type === 'ungroup'
            )
        ) {
            returnFocusId = [...scene.selection.value][0] ?? null
        }
        close()
    }

    async function restoreFocus(): Promise<void> {
        await nextTick()
        if (options.disabled() || request.value) return

        const viewport = options.viewport.value
        const elements = viewport
            ?.querySelectorAll<HTMLElement>('[data-piece-id]')

        const opener = Array.from(elements ?? []).find(
            element => element.dataset.pieceId === returnFocusId,
        )

        const target = opener ?? viewport
        target?.focus({ preventScroll: true })
    }

    watch(options.disabled, disabled => {
        if (disabled) close()
    }, { flush: 'sync' })

    // Close if another operation removes the requesting train.
    watch(() => scene.trains.value, trains => {
        const id = request.value?.trainId
        if (id && !trains.some(train => train.id === id)) close()
    })

    onDeactivated(close)

    return {
        request: readonly(request),
        selectedIds,
        selectTrain,
        open,
        close,
        applyAction,
        restoreFocus,
    }
}
