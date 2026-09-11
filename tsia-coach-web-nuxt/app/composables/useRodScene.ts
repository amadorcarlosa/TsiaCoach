import { readonly, ref } from 'vue'
import type { Point } from '~/components/grid/gridPointer'
import type {
    AddendChoice,
    FactorChoice,
    RodTrain,
    SceneAction,
    SceneApplyResult,
    ScenePolicy,
    SceneResult,
    TrainPart
} from '~/components/rod/scene/rod.scene.types'
import {validateScene} from "~/components/rod/scene/rod-scene.placement.ts";
import { addendPairs } from '~/components/rod/scene/addend-groupings'
import { factorShapes } from '~/components/rod/scene/factor-groupings'
import {
    copyScene,
    type SceneSnapshot,
} from '~/components/rod/scene/scene-snapshot'
import { trainOrientation } from '~/components/rod/scene/train-orientation'
import { trainFitsRegion } from '~/components/rod/scene/scene-regions'


type Candidate =
    | { allowed: true; trains: RodTrain[] }
    | { allowed: false; reason: string }

type LinearLayout =
    | {
        allowed: true
        orientation: TrainPart['orientation']
        vertical: boolean
        start: Point
        total: number
    }
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

    function buildReplacement(source: SceneSnapshot): Candidate {
        if (!policy.editable()) {
            return reject('Editing is unavailable.')
        }

        const candidate = copyScene(source)
        const ids = new Set<string>()

        for (const train of candidate) {
            if (!train.id.trim() || ids.has(train.id)) {
                return reject('Every train needs a unique, non-empty ID.')
            }
            ids.add(train.id)

            if (
                !Number.isInteger(train.anchor.x) ||
                !Number.isInteger(train.anchor.y)
            ) {
                return reject('Train anchors must use integer cells.')
            }

            if (train.parts.length === 0) {
                return reject('Every train needs at least one part.')
            }

            for (const part of train.parts) {
                if (
                    !Number.isInteger(part.value) ||
                    part.value < 1 ||
                    part.value > 10
                ) {
                    return reject('Rod values must be integers from 1 to 10.')
                }

                if (
                    !Number.isInteger(part.offset.x) ||
                    !Number.isInteger(part.offset.y)
                ) {
                    return reject('Part offsets must use integer cells.')
                }

                if (
                    !['horizontal', 'vertical', 'tower']
                        .includes(part.orientation)
                ) {
                    return reject('Unknown rod orientation.')
                }

                if (
                    !policy.allowOrientation &&
                    part.orientation !== 'horizontal'
                ) {
                    return reject('This scene accepts horizontal rods only.')
                }
            }
        }

        return validate(candidate)
    }

    function checkReplacement(source: SceneSnapshot): SceneResult {
        const result = buildReplacement(source)

        return result.allowed
            ? { allowed: true }
            : result
    }

    /**
     * Authoring hydration boundary.
     * Interactive edits continue to use apply().
     * Call through replaceScene() in the interaction composable.
     */
    function replace(source: SceneSnapshot): SceneResult {
        const result = buildReplacement(source)

        if (!result.allowed) return result

        trains.value = result.trains
        selection.value = new Set()
        message.value = ''

        return { allowed: true }
    }

    function linearLayout(train: RodTrain): LinearLayout {
        const first = train.parts[0]

        if (!first) {
            return { allowed: false, reason: 'This train has no parts.' }
        }

        const orientation = first.orientation

        if (train.parts.some(part => part.orientation === 'tower')) {
            return {
                allowed: false,
                reason: 'Lay the tower horizontally or vertically before decomposing.',
            }
        }

        if (train.parts.some(part => part.orientation !== orientation)) {
            return {
                allowed: false,
                reason: 'Arrange each selected train horizontally or vertically first.',
            }
        }

        const vertical = orientation === 'vertical'

        const ordered = [...train.parts].sort((a, b) =>
            vertical
                ? a.offset.y - b.offset.y
                : a.offset.x - b.offset.x,
        )

        const start = { ...ordered[0]!.offset }
        let total = 0

        // Require a continuous line and preserve its occupied footprint.
        for (const part of ordered) {
            const expectedX = start.x + (vertical ? 0 : total)
            const expectedY = start.y + (vertical ? total : 0)

            if (
                part.offset.x !== expectedX ||
                part.offset.y !== expectedY
            ) {
                return {
                    allowed: false,
                    reason: 'Arrange each selected train in one continuous line first.',
                }
            }

            total += part.value
        }

        return {
            allowed: true,
            orientation,
            vertical,
            start,
            total,
        }
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
            if (action.regionId !== undefined) {
                if (action.row !== undefined) {
                    return reject('Choose a region or a row, not both.')
                }
                const region = policy.regions?.find(item => item.id === action.regionId)
                if (!region) return reject('Choose an available region.')
                const orientation = region.orientations[0]
                if (!orientation) return reject('This region does not accept rods.')

                for (let y = region.y; y < region.y + region.depth; y++) {
                    for (let x = region.x; x < region.x + region.width; x++) {
                        const train: RodTrain = {
                            id: '', anchor: { x, y },
                            parts: [{ value: action.value, offset: { x: 0, y: 0 }, orientation }],
                        }
                        if (!trainFitsRegion(train, region)) continue
                        const result = validate([...current, train])
                        if (result.allowed) return result
                    }
                }
                return reject(`No room for a ${action.value}-rod in this region.`)
            }

            const requestedRow = action.row

            if (
                requestedRow !== undefined &&
                (
                    !Number.isInteger(requestedRow) ||
                    !policy.spawnRows.includes(requestedRow)
                )
            ) {
                return reject('Choose an available track.')
            }

            const candidateRows =
                requestedRow === undefined
                    ? policy.spawnRows
                    : [requestedRow]

            for (const y of candidateRows) {
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

            case 'set-orientation': {
                if (!policy.allowOrientation) {
                    return reject('This scene does not allow orientation changes.')
                }

                const orientation = action.orientation

                if (
                    orientation === 'tower' &&
                    selected.some(train => train.parts.length > 1)
                ) {
                    return reject('Tower is available only for individual rods.')
                }

                for (const train of selected) {
                    if (train.parts.length === 1) {
                        // Preserve existing single-rod behavior:
                        // change orientation at the current anchor.
                        train.parts[0]!.orientation = orientation
                        continue
                    }

                    if (orientation === 'tower') {
                        return reject('Tower is available only for individual rods.')
                    }

                    if (trainOrientation(train) === undefined) {
                        return reject(
                            'Choose another factor arrangement to change this rectangle.',
                        )
                    }

                    const total = train.parts.reduce(
                        (sum, part) => sum + part.value,
                        0,
                    )

                    const width = orientation === 'horizontal' ? total : 1
                    const depth = orientation === 'vertical' ? total : 1

                    if (width > policy.columns || depth > policy.rows) {
                        return reject(
                            `A value-${total} train cannot fit ${orientation}ly ` +
                            `on this ${policy.columns}-column, ${policy.rows}-row board.`,
                        )
                    }

                    // Preserve array order and each part's catalog value.
                    let cursor = 0

                    train.parts = train.parts.map(part => {
                        const transformed = {
                            ...part,
                            orientation,
                            offset: orientation === 'horizontal'
                                ? { x: cursor, y: 0 }
                                : { x: 0, y: cursor },
                        }

                        cursor += part.value
                        return transformed
                    })

                    // Minimal edge correction; no search for unoccupied space.
                    train.anchor = {
                        x: Math.max(
                            0,
                            Math.min(train.anchor.x, policy.columns - width),
                        ),
                        y: Math.max(
                            0,
                            Math.min(train.anchor.y, policy.rows - depth),
                        ),
                    }
                }

                // Validate all transformed destinations together.
                const result = validate(current)

                return result.allowed
                    ? result
                    : reject(`Cannot change orientation. ${result.reason}`)
            }

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
            case 'regroup-ones': {
                for (const train of selected) {
                    const layout = linearLayout(train)
                    if (!layout.allowed) return layout

                    train.parts = Array.from(
                        { length: layout.total },
                        (_, index): TrainPart => ({
                            value: 1,
                            orientation: layout.orientation,
                            offset: {
                                x: layout.start.x + (layout.vertical ? 0 : index),
                                y: layout.start.y + (layout.vertical ? index : 0),
                            },
                        }),
                    )
                }

                return validate(current)
            }

            case 'regroup-addends': {
                for (const train of selected) {
                    const layout = linearLayout(train)
                    if (!layout.allowed) return layout

                    const candidates = addendPairs(layout.total)
                    const requested = action.pair

                    const pair = requested
                        ? candidates.find(candidate =>
                            candidate[0] === requested[0] &&
                            candidate[1] === requested[1],
                        )
                        : candidates[0]

                    if (!pair) {
                        return reject(
                            requested
                                ? 'Choose two rods valued 1–10 that add to this object’s value.'
                                : `Value ${layout.total} has no two-addend arrangement using rods valued 1–10.`,
                        )
                    }

                    let cursor = 0

                    // Preserve the chosen pair's order. Do not sort it.
                    train.parts = pair.map((value): TrainPart => {
                        const part: TrainPart = {
                            value,
                            orientation: layout.orientation,
                            offset: {
                                x: layout.start.x + (layout.vertical ? 0 : cursor),
                                y: layout.start.y + (layout.vertical ? cursor : 0),
                            },
                        }

                        cursor += value
                        return part
                    })
                }

                return validate(current)
            }

            case 'regroup-factors': {
                if (!policy.allowFactors) {
                    return reject('Factor arrangements are available in Array.')
                }

                for (const train of selected) {
                    if (!train.parts.length) {
                        return reject('This train has no parts.')
                    }

                    if (train.parts.some(part => part.orientation === 'tower')) {
                        return reject(
                            'Lay the tower horizontally or vertically before decomposing.',
                        )
                    }

                    const total = train.parts.reduce(
                        (sum, part) => sum + part.value,
                        0,
                    )

                    const candidates = factorShapes(total)
                    const requested = action.shape

                    const shape = requested
                        ? candidates.find(candidate =>
                            candidate.rows === requested.rows &&
                            candidate.columns === requested.columns,
                        )
                        : candidates[0]

                    if (!shape) {
                        return reject(
                            requested
                                ? 'Choose a supported factor arrangement for this value.'
                                : `Value ${total} has no supported factor arrangement with both factors greater than one.`,
                        )
                    }

                    train.parts = Array.from(
                        { length: shape.rows },
                        (_, row): TrainPart => ({
                            value: shape.columns,
                            orientation: 'horizontal',
                            offset: { x: 0, y: row },
                        }),
                    )
                }

                const result = validate(current)

                return result.allowed
                    ? result
                    : reject(`Cannot arrange these factors. ${result.reason}`)
            }

            case 'ungroup': {
                if (selected.some(train => train.parts.length < 2)) {
                    return reject('Select only trains with multiple parts.')
                }

                const released: RodTrain[] = selected.flatMap(train =>
                    train.parts.map(part => ({
                        id: '', // Assigned only after validation succeeds.
                        anchor: {
                            x: train.anchor.x + part.offset.x,
                            y: train.anchor.y + part.offset.y,
                        },
                        parts: [{
                            ...part,
                            offset: { x: 0, y: 0 },
                        }],
                    })),
                )

                return validate([
                    ...current.filter(train => !selectedIds.has(train.id)),
                    ...released,
                ])
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
    ): SceneApplyResult {
        // Rebuild and recheck against the scene as it exists now.
        const result = build(ids, action)

        if (!result.allowed) {
            message.value = result.reason
            return result
        }

        const createdIds: string[] = []
        const occupiedIds = new Set(
            result.trains
                .filter(train => train.id !== '')
                .map(train => train.id),
        )

        const committed = result.trains.map(train => {
            if (train.id) return train

            let id: string

            do {
                id = `train-${nextId++}`
            } while (occupiedIds.has(id))

            occupiedIds.add(id)
            createdIds.push(id)

            return { ...train, id }
        })

        const existingIds = new Set(committed.map(train => train.id))

        const selectsCreatedTrains =
            action.type === 'make-train' ||
            action.type === 'ungroup'

        const nextSelection = selectsCreatedTrains
            ? new Set(createdIds)
            : new Set(
                [...selection.value].filter(id => existingIds.has(id)),
            )

        trains.value = committed
        selection.value = nextSelection

        message.value = ''
        return { allowed: true, createdIds }
    }

    function getAddendChoices(id: string): AddendChoice[] {
        const train = trains.value.find(train => train.id === id)
        if (!train) return []

        const total = train.parts.reduce(
            (sum, part) => sum + part.value,
            0,
        )

        return addendPairs(total).map(pair => ({
            pair,
            result: check([id], {
                type: 'regroup-addends',
                pair,
            }),
        }))
    }

    function getFactorChoices(id: string): FactorChoice[] {
        const train = trains.value.find(train => train.id === id)
        if (!train) return []

        const total = train.parts.reduce(
            (sum, part) => sum + part.value,
            0,
        )

        return factorShapes(total).map(shape => ({
            shape,
            result: check([id], {
                type: 'regroup-factors',
                shape,
            }),
        }))
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
        if (policy.regions) {
            const selectedIds = new Set(ids)
            const selected = trains.value.filter(train => selectedIds.has(train.id))
            let best = { x: 0, y: 0 }
            let bestDistance = Number.POSITIVE_INFINITY
            let bestTravel = Number.POSITIVE_INFINITY

            for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
                for (let x = Math.ceil(minX); x <= Math.floor(maxX); x++) {
                    const fits = selected.every(train => {
                        const proposed = {
                            ...train,
                            anchor: { x: train.anchor.x + x, y: train.anchor.y + y },
                        }
                        return policy.regions!.some(region => trainFitsRegion(proposed, region))
                    })
                    if (!fits) continue
                    const distance = (x - delta.x) ** 2 + (y - delta.y) ** 2
                    const travel = x * x + y * y
                    if (distance < bestDistance || (distance === bestDistance && travel < bestTravel)) {
                        best = { x: x || 0, y: y || 0 }
                        bestDistance = distance
                        bestTravel = travel
                    }
                }
            }
            return best
        }
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
        checkReplacement,
        replace,
        select,
        constrainMove,
        getAddendChoices,
        getFactorChoices,
    }
}
