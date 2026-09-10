import { readonly, ref } from 'vue'
import type { Point } from '~/components/grid/gridPointer'
import type {
    RodTrain,
    SceneAction,
    ScenePolicy,
    SceneResult,
    TrainPart
} from "~/components/rod/scene/rod.scene.types.ts";
import {validateScene} from "~/components/rod/scene/rod-scene.placement.ts";


type Candidate =
    | { allowed: true; trains: RodTrain[] }
    | { allowed: false; reason: string }

export function useRodScene(policy: ScenePolicy) {
    const trains = ref<RodTrain[]>([])
    const selection = ref<Set<string>>(new Set())
    const message = ref('')
    let nextId = 1

    function reject(reason: string): Candidate {
        return { allowed: false, reason }
    }

    function validate(candidate: RodTrain[]): Candidate {
        const result = validateScene(candidate, policy)

        return result.allowed
            ? { allowed: true, trains: candidate }
            : result
    }

    function build(
        ids: readonly string[],
        action: SceneAction,
    ): Candidate {
        if (!policy.editable()) {
            return reject('Editing is unavailable in portrait preview.')
        }

        // Never mutate the current scene while preparing an action.
        const current: RodTrain[] = trains.value.map(train => ({
            ...train,
            anchor: { ...train.anchor },
            parts: train.parts.map(part => ({
                ...part,
                offset: { ...part.offset },
            })),
        }))

        if (action.type === 'create') {
            for (const y of policy.spawnRows) {
                for (let x = 0; x < policy.columns; x++) {
                    const result = validate([
                        ...current,
                        {
                            id: '', // Assigned only after successful validation.
                            anchor: { x, y },
                            parts: [{
                                value: action.value,
                                offset: { x: 0, y: 0 },
                                orientation: 'horizontal',
                            }],
                        },
                    ])

                    if (result.allowed) return result
                }
            }

            return reject(`No room for a ${action.value}-rod.`)
        }

        const selectedIds = new Set(ids)
        const selected = current.filter(train =>
            selectedIds.has(train.id),
        )

        if (
            selectedIds.size === 0 ||
            selected.length !== selectedIds.size
        ) {
            return reject('Select existing trains first.')
        }

        switch (action.type) {
            case 'delete':
                return validate(
                    current.filter(train => !selectedIds.has(train.id)),
                )

            case 'move':
                for (const train of selected) {
                    train.anchor.x += action.delta.x
                    train.anchor.y += action.delta.y
                }
                return validate(current)

            case 'set-orientation':
                if (!policy.allowOrientation) {
                    return reject('This scene does not allow orientation changes.')
                }

                if (selected.some(train => train.parts.length !== 1)) {
                    return reject('This action requires single-part trains.')
                }

                for (const train of selected) {
                    train.parts[0]!.orientation = action.orientation
                }

                return validate(current)

            case 'clone': {
                // Search nearby offsets first. One shared offset preserves
                // the selected trains' positions relative to each other.
                const offsets = []

                for (let y = -policy.rows; y <= policy.rows; y++) {
                    for (let x = -policy.columns; x <= policy.columns; x++) {
                        if (x !== 0 || y !== 0) offsets.push({ x, y })
                    }
                }

                offsets.sort((a, b) =>
                    (Math.abs(a.x) + Math.abs(a.y)) -
                    (Math.abs(b.x) + Math.abs(b.y)) ||
                    b.x - a.x ||
                    b.y - a.y,
                )

                for (const offset of offsets) {
                    const copies = selected.map(train => ({
                        ...train,
                        id: '',
                        anchor: {
                            x: train.anchor.x + offset.x,
                            y: train.anchor.y + offset.y,
                        },
                        parts: train.parts.map(part => ({
                            ...part,
                            offset: { ...part.offset },
                        })),
                    }))

                    const result = validate([...current, ...copies])
                    if (result.allowed) return result
                }

                return reject('No room to clone the selection.')
            }

            case 'make-train': {
                if (selected.length < 2) {
                    return reject('Select at least two trains.')
                }

                const allFlatAndHorizontal = selected.every(train => {
                    const first = train.parts[0]
                    if (!first) return false

                    return train.parts.every(part =>
                        part.orientation === 'horizontal' &&
                        part.offset.y === first.offset.y,
                    )
                })

                if (!allFlatAndHorizontal) {
                    return reject('Lay all selected rods horizontally first.')
                }

                const ordered = [...selected].sort((a, b) =>
                    a.anchor.y - b.anchor.y ||
                    a.anchor.x - b.anchor.x ||
                    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
                )

                const parts: TrainPart[] = []
                let cursor = 0

                for (const train of ordered) {
                    const orderedParts = train.parts
                        .map((part, index) => ({ part, index }))
                        .sort((a, b) =>
                            a.part.offset.x - b.part.offset.x ||
                            a.index - b.index,
                        )

                    for (const { part } of orderedParts) {
                        parts.push({
                            ...part,
                            offset: { x: cursor, y: 0 },
                        })

                        cursor += part.value
                    }
                }

                const combined: RodTrain = {
                    id: '',
                    anchor: { ...ordered[0]!.anchor },
                    parts,
                }

                return validate([
                    ...current.filter(train => !selectedIds.has(train.id)),
                    combined,
                ])
            }

            default: {
                const exhaustive: never = action
                return exhaustive
            }
        }
    }
    

    function check(
        ids: readonly string[],
        action: SceneAction,
    ): SceneResult {
        const result = build(ids, action)

        return result.allowed ? { allowed: true } : result
    }

    function apply(
        ids: readonly string[],
        action: SceneAction,
    ): SceneResult {
        // Rebuild and recheck against the scene as it exists now.
        const result = build(ids, action)

        if (!result.allowed) {
            message.value = result.reason
            return result
        }

        const createdIds: string[] = []

        const committed = result.trains.map(train => {
            if (train.id) return train

            const id = `train-${nextId++}`
            createdIds.push(id)

            return { ...train, id }
        })

        const existingIds = new Set(committed.map(train => train.id))

        const nextSelection = action.type === 'make-train'
            ? new Set(createdIds)
            : new Set(
                [...selection.value].filter(id => existingIds.has(id)),
            )

        trains.value = committed
        selection.value = nextSelection

        message.value = ''
        return { allowed: true }
    }

    function select(ids: readonly string[]): void {
        const existingIds = new Set(trains.value.map(train => train.id))
        selection.value = new Set(ids.filter(id => existingIds.has(id)))
    }

    function constrainMove(ids: readonly string[], delta: Point, direction?: Point): Point {
        const parts = trains.value.filter(train => ids.includes(train.id))
            .flatMap(train => train.parts.map(part => ({
                x: train.anchor.x + part.offset.x,
                y: train.anchor.y + part.offset.y,
                width: part.orientation === 'horizontal' ? part.value : 1,
                depth: part.orientation === 'vertical' ? part.value : 1,
            })))
        if (!parts.length) return { x: 0, y: 0 }
        const minX = -Math.min(...parts.map(part => part.x))
        const maxX = policy.columns - Math.max(...parts.map(part => part.x + part.width))
        const minY = -Math.min(...parts.map(part => part.y))
        const maxY = policy.rows - Math.max(...parts.map(part => part.y + part.depth))
        if (minX > maxX || minY > maxY) return { x: 0, y: 0 }
        const x = Math.max(minX, Math.min(maxX, Math.round(delta.x)))
        if (!policy.trackRows) {
            return { x, y: Math.max(minY, Math.min(maxY, Math.round(delta.y))) }
        }
        const rows = policy.trackRows.map(row => row - parts[0]!.y)
            .filter(offset => parts.every(part => policy.trackRows!.includes(part.y + offset)))
        if (minX > maxX || !rows.length) return { x: 0, y: 0 }
        const candidates = direction?.y
            ? rows.filter(row => Math.sign(row) === Math.sign(direction.y))
            : rows
        const y = candidates.sort((a, b) =>
            Math.abs(a - delta.y) - Math.abs(b - delta.y) || Math.abs(a) - Math.abs(b),
        )[0] ?? 0
        return { x, y }
    }

    return {
        trains: readonly(trains),
        selection: readonly(selection),
        message: readonly(message),
        check,
        apply,
        select,
        constrainMove,
    }
}
