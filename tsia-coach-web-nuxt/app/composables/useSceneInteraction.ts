import { computed, shallowRef } from 'vue'
import type { Point } from '~/components/grid/gridPointer'
import type { SelectionIntent } from '~/components/rod/scene/scene-interaction.types'
import type { useRodScene } from './useRodScene'

type RodScene = ReturnType<typeof useRodScene>

type MoveSession = {
    leaderId: string
    ids: string[]
    origin: Point
}

export function useSceneInteraction(options: {
    scene: RodScene
    blocked: () => boolean
}) {
    const { scene } = options

    const session = shallowRef<MoveSession | null>(null)
    const delta = shallowRef<Point>({ x: 0, y: 0 })

    let source: RodScene['trains']['value'] | null = null

    const leaderId = computed(() => session.value?.leaderId ?? null)

    function select(id: string, intent: SelectionIntent): void {
        if (options.blocked() || session.value) return
        if (!scene.trains.value.some(train => train.id === id)) return

        const selected = new Set(scene.selection.value)

        switch (intent.mode) {
            case 'replace':
                scene.select([id])
                break

            case 'preserve':
                if (!selected.has(id)) scene.select([id])
                break

            case 'toggle':
                if (selected.has(id)) selected.delete(id)
                else selected.add(id)

                scene.select([...selected])
                break
        }
    }

    function beginMove(id: string): boolean {
        if (options.blocked() || session.value) return false

        const train = scene.trains.value.find(train => train.id === id)
        if (!train) return false

        select(id, { mode: 'preserve' })

        // Capture the target set now, not when the drop finishes.
        source = scene.trains.value

        session.value = {
            leaderId: id,
            ids: [...scene.selection.value],
            origin: {
                ...train.anchor,
            },
        }

        delta.value = { x: 0, y: 0 }
        return true
    }

    function previewMove(id: string, position: Point): void {
        const current = session.value
        if (!current || current.leaderId !== id) return

        delta.value = {
            x: position.x - current.origin.x,
            y: position.y - current.origin.y,
        }
    }

    function constrainPosition(id: string, position: Point, direction?: Point): Point {
        const current = session.value
        if (!current || current.leaderId !== id) return position
        const movement = scene.constrainMove(current.ids, {
            x: position.x - current.origin.x,
            y: position.y - current.origin.y,
        }, direction)
        return {
            x: current.origin.x + movement.x,
            y: current.origin.y + movement.y,
        }
    }

    function settleMove(id: string, position: Point): void {
        const current = session.value
        if (!current || current.leaderId !== id) return

        // A different scene edit invalidates this gesture's baseline.
        if (!options.blocked() && scene.trains.value === source) {
            scene.apply(current.ids, {
                type: 'move',
                delta: {
                    x: position.x - current.origin.x,
                    y: position.y - current.origin.y,
                },
            })
        }

        // Committed props now determine the followers' positions.
        delta.value = { x: 0, y: 0 }
    }

    function endMove(id: string): void {
        if (session.value?.leaderId !== id) return

        session.value = null
        source = null
        delta.value = { x: 0, y: 0 }
    }

    function previewFor(id: string): Point | undefined {
        const current = session.value

        if (
            !current ||
            current.leaderId === id ||
            !current.ids.includes(id)
        ) return undefined

        return delta.value
    }

    return {
        leaderId,
        select,
        beginMove,
        constrainPosition,
        previewMove,
        settleMove,
        endMove,
        previewFor,
    }
}
