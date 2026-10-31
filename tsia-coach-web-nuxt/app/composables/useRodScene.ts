import { validateSnapshot } from '~/components/rod/scene/validate-snapshot'
import { readonly, ref } from 'vue'
import type { Point } from '~/components/grid/gridPointer'
import type {
    AddendChoice,
    AreaGroupingChoice,
    FactorChoice,
    RodTrain,
    SceneAction,
    SceneApplyResult,
    ScenePolicy,
    SceneResult,
    TrainPart
} from '~/components/rod/scene/rod.scene.types'
import { layeredRoleOf, validateScene } from '~/components/rod/scene/rod-scene.placement'
import { signedAddendPairs } from '~/components/rod/scene/addend-groupings'
import {
    MIXED_SIGN_REGROUP_REASON,
    isRodSign,
    signField,
    trainMagnitude,
    trainSignKind,
    trainSignedTotal,
    trainUniformSign,
} from '~/components/rod/scene/rod-arithmetic'
import { factorShapes } from '~/components/rod/scene/factor-groupings'
import {
    areaGroupParts,
    areaGroupReading,
    areaGroupReadings,
    areaGroupingOf,
    tiledRectangle,
} from '~/components/tabla/area-grouping'
import type { SceneSnapshot } from '~/components/rod/scene/scene-snapshot'
import { regionAt, trainFitsRegion } from '~/components/rod/scene/scene-regions'
import { trainOrientation } from '~/components/rod/scene/train-orientation'
import { contains, partFootprint, trainBounds, trainFootprints } from '~/components/rod/scene/part-footprint'
import { offsetsByDistance, onBoardRange } from '~/components/grid/nearest-offsets'
import {
    createTurnMemory,
    edgeShift,
    settleTurn,
    shifted,
    type TurnedPiece,
} from '~/components/grid/rotation-fit'
import {
    makeLinearTrain,
    orientTrain,
    regroupTrainToAddends,
    regroupTrainToOnes,
    releaseTrain,
} from '~/components/rod/scene/linear-train-operations'


type Turn = { id: string; inverse: string; shift: Point }

type Candidate =
    | { allowed: true; trains: RodTrain[]; turns?: Turn[] }
    | { allowed: false; reason: string }

/** Identifies a train's exact placement, for the turn memory. */
const trainState = (train: RodTrain) => JSON.stringify([train.anchor, train.parts])

export function useRodScene(policy: ScenePolicy) {
    const trains = ref<RodTrain[]>([])
    const selection = ref<Set<string>>(new Set())
    const message = ref('')
    const turnMemory = createTurnMemory()
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

    const layeredActive = () => policy.layeredRoles?.enabled() === true

    /** The role a train plays now: its layered role, else its stored one. */
    function effectiveRole(train: RodTrain) {
        return layeredRoleOf(train, policy) ?? train.materialRole ?? null
    }

    function buildReplacement(source: SceneSnapshot): Candidate {
        if (!policy.editable()) {
            return reject('Editing is unavailable.')
        }

        return validateSnapshot(source, policy)
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
            if (action.materialRole !== undefined && !layeredActive()) {
                return reject('Material roles are available in fraction multiplication.')
            }

            // The tray's sign is untrusted input: only 1 and -1, and -1 only
            // where the board opted in. Hiding the toggle is not validation.
            if (action.sign !== undefined && !isRodSign(action.sign)) {
                return reject('Rod signs must be 1 or -1.')
            }
            if (action.sign === -1 && !policy.allowNegativeRods) {
                return reject('This board accepts positive rods only.')
            }
            const sign = signField(action.sign ?? 1)
            const rodName = `${action.sign === -1 ? 'negative ' : ''}${action.value}-rod`

            // Creation intent travels with the train; it is never inferred later.
            const role = action.materialRole
                ? { materialRole: action.materialRole }
                : {}

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
                            parts: [{ value: action.value, ...sign, offset: { x: 0, y: 0 }, orientation }],
                            ...role,
                        }
                        if (!trainFitsRegion(train, region)) continue
                        const result = validate([...current, train])
                        if (result.allowed) return result
                    }
                }
                return reject(`No room for a ${rodName} in this region.`)
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
                                ...sign,
                                offset: { x: 0, y: 0 },
                                orientation: 'horizontal',
                            }],
                            ...role,
                        },
                    ])

                    if (result.allowed) return result
                }
            }

            return reject(`No room for a ${rodName}.`)
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

                const turned: (TurnedPiece & { inverse: string })[] = []

                for (const train of selected) {
                    const transformed = orientTrain(
                        train,
                        action.orientation,
                        policy,
                    )
                    if (!transformed.allowed) return transformed

                    // Slide back inside the region the train started in, or
                    // the board when the scene has no regions.
                    const region = policy.regions && regionAt(policy.regions, train.anchor)
                    const bounds = region ?? { x: 0, y: 0, width: policy.columns, depth: policy.rows }
                    const edge = edgeShift(trainBounds(transformed.value), bounds)
                    if (!edge) return reject('Cannot change orientation. The train does not fit in its area.')

                    turned.push({
                        id: train.id,
                        edge,
                        back: turnMemory.returnShift(train.id, trainState(train), action.orientation),
                        inverse: trainOrientation(train) ?? '',
                    })
                    train.anchor = transformed.value.anchor
                    train.parts = transformed.value.parts
                }

                // Validate all transformed destinations together.
                const { result, shifts } = settleTurn(turned, shifts => validate(
                    current.map(train => shifts.has(train.id)
                        ? { ...train, anchor: shifted(train.anchor, shifts.get(train.id)) }
                        : train),
                ))

                return result.allowed
                    ? {
                        ...result,
                        turns: turned.map(turn => ({
                            id: turn.id,
                            inverse: turn.inverse,
                            shift: shifts.get(turn.id)!,
                        })),
                    }
                    : reject(`Cannot change orientation. ${result.reason}`)
            }

            case 'clone': {
                // Search nearby offsets first. One shared offset preserves
                // the selected trains' positions relative to each other.
                // Only offsets that keep the copy on the board are tried.
                const offsets = offsetsByDistance(onBoardRange(
                    selected.flatMap(trainFootprints),
                    policy.columns,
                    policy.rows,
                ))

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

            case 'set-material-role': {
                if (!layeredActive()) {
                    return reject('Material roles are available in fraction multiplication.')
                }

                // The only way a role changes; moving a piece never does this.
                for (const train of selected) {
                    train.materialRole = action.materialRole
                }

                return validate(current)
            }

            case 'make-train': {
                if (new Set(selected.map(effectiveRole)).size > 1) {
                    return reject(
                        'Select material of one kind: denominator tiles and numerator rods cannot join one train.',
                    )
                }

                const combined = makeLinearTrain(selected)
                if (!combined.allowed) return combined

                const storedRole = selected[0]!.materialRole
                if (storedRole && selected.every(train => train.materialRole === storedRole)) {
                    combined.value.materialRole = storedRole
                }

                return validate([
                    ...current.filter(train => !selectedIds.has(train.id)),
                    combined.value,
                ])
            }
            case 'regroup-ones': {
                for (const train of selected) {
                    const regrouped = regroupTrainToOnes(train)
                    if (!regrouped.allowed) return regrouped

                    train.parts = regrouped.value.parts
                }

                return validate(current)
            }

            case 'regroup-addends': {
                const addends: RodTrain[] = []
                for (const train of selected) {
                    const regrouped = regroupTrainToAddends(train, action.pair)
                    if (!regrouped.allowed) return regrouped
                    addends.push(...regrouped.value)
                }
                return validate([
                    ...current.filter(train => !selectedIds.has(train.id)),
                    ...addends,
                ])
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

                    // Arranged by magnitude: -14 can show 2 rows of negative 7.
                    const sign = trainUniformSign(train)
                    if (sign === undefined) return reject(MIXED_SIGN_REGROUP_REASON)

                    const total = trainMagnitude(train)

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
                            ...signField(sign),
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

            case 'regroup-area': {
                if (!policy.allowAreaRegroup) {
                    return reject('Area grouping is available in MathTabla.')
                }

                if (selected.length !== 1) {
                    return reject(
                        'Select one filled rectangle to regroup its area.',
                    )
                }

                const train = selected[0]!

                // Area grouping has no signed meaning defined yet.
                if (trainSignKind(train) !== 'positive') {
                    return reject('Area grouping is available for positive rods only.')
                }

                if (train.parts.some(part => part.orientation === 'tower')) {
                    return reject(
                        'Lay the tower horizontally or vertically before regrouping.',
                    )
                }

                // A bounding box or a total would accept holes, L shapes and
                // overlaps; regrouping must preserve the exact cell set.
                const rectangle = tiledRectangle(train)

                if (!rectangle) {
                    return reject(
                        'Select one object that completely fills a rectangle, ' +
                        'with no gaps and no overlaps.',
                    )
                }

                const reading = areaGroupReading(rectangle, action.grouping)

                if (!reading) {
                    return reject('This area cannot be grouped.')
                }

                const parts = areaGroupParts(rectangle, action.grouping)

                if (!parts) {
                    return reject(
                        `A group of ${reading.unitsPerGroup} square units needs ` +
                        `a ${reading.unitsPerGroup}-rod, and rods are valued 1–10. ` +
                        'Group the whole instead to show these parts flat.',
                    )
                }

                train.parts = parts

                const result = validate(current)

                return result.allowed
                    ? result
                    : reject(`Cannot regroup this area. ${result.reason}`)
            }

            case 'ungroup': {
                const released: RodTrain[] = []

                for (const train of selected) {
                    const result = releaseTrain(train)
                    if (!result.allowed) return result
                    released.push(...result.value.map(piece =>
                        train.materialRole
                            ? { ...piece, materialRole: train.materialRole }
                            : piece,
                    ))
                }

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

        const nextSelection = action.type === 'regroup-addends'
            ? new Set(createdIds.slice(0, 1))
            : selectsCreatedTrains
            ? new Set(createdIds)
            : new Set(
                [...selection.value].filter(id => existingIds.has(id)),
            )

        trains.value = committed
        selection.value = nextSelection

        turnMemory.keep(existingIds)
        for (const turn of result.turns ?? []) {
            const train = committed.find(item => item.id === turn.id)
            if (train) turnMemory.remember(turn.id, { ...turn, state: trainState(train) })
        }

        message.value = ''
        return { allowed: true, createdIds }
    }

    function getAddendChoices(id: string): AddendChoice[] {
        const train = trains.value.find(train => train.id === id)
        // Mixed signs have no finite, instructional list of splits yet.
        if (!train || trainSignKind(train) === 'mixed') return []

        return signedAddendPairs(trainSignedTotal(train)).map(pair => ({
            pair,
            result: check([id], {
                type: 'regroup-addends',
                pair,
            }),
        }))
    }

    function getFactorChoices(id: string): FactorChoice[] {
        const train = trains.value.find(train => train.id === id)
        if (!train || trainSignKind(train) === 'mixed') return []

        return factorShapes(trainMagnitude(train)).map(shape => ({
            shape,
            result: check([id], {
                type: 'regroup-factors',
                shape,
            }),
        }))
    }

    /**
     * Derived from the selected rectangle's own dimensions, never from a
     * denominator: a numerator rectangle may fill only part of a larger whole.
     */
    function getAreaGroupingChoices(id: string): AreaGroupingChoice[] {
        const train = trains.value.find(train => train.id === id)
        if (!train) return []

        const rectangle = tiledRectangle(train)
        if (!rectangle) return []

        const current = areaGroupingOf(train)

        return areaGroupReadings(rectangle).map(reading => ({
            reading,
            result: check([id], {
                type: 'regroup-area',
                grouping: reading.grouping,
            }),
            active: current === reading.grouping,
        }))
    }

    function select(ids: readonly string[]): void {
        const existingIds = new Set(trains.value.map(train => train.id))
        selection.value = new Set(ids.filter(id => existingIds.has(id)))
    }

    function constrainMove(ids: readonly string[], delta: Point, direction?: Point): Point {
        const parts = trains.value.filter(train => ids.includes(train.id))
            .flatMap(trainFootprints)
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

            // Mirror the layered rules so a preview never offers a destination
            // that settling would refuse.
            const layered = layeredActive() ? policy.layeredRoles! : null
            const layeredRegion = layered
                ? policy.regions.find(region => region.id === layered.regionId)
                : undefined
            const movesNumerator = layered !== null &&
                selected.some(train => layeredRoleOf(train, policy) === 'numerator')

            for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
                for (let x = Math.ceil(minX); x <= Math.floor(maxX); x++) {
                    const moved = selected.map(train => ({
                        ...train,
                        anchor: { x: train.anchor.x + x, y: train.anchor.y + y },
                    }))
                    const fits = moved.every(proposed =>
                        policy.regions!.some(region => trainFitsRegion(proposed, region)) &&
                        (!layeredRegion || proposed.materialRole === undefined ||
                            trainFitsRegion(proposed, layeredRegion)),
                    )
                    if (!fits) continue

                    if (movesNumerator) {
                        const candidate = trains.value.map(train =>
                            moved.find(item => item.id === train.id) ?? train,
                        )
                        const whole = layered!.wholeOf(candidate)
                        const inside = whole !== null && moved
                            .filter(train => layeredRoleOf(train, policy) === 'numerator')
                            .every(train => train.parts.every(part =>
                                contains(whole, partFootprint(part, train.anchor)),
                            ))
                        if (!inside) continue
                    }
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
        validateSnapshot: (source: SceneSnapshot): SceneResult => {
            const result = validateSnapshot(source, policy)
            return result.allowed ? { allowed: true } : result
        },
        replace,
        select,
        constrainMove,
        getAddendChoices,
        getFactorChoices,
        getAreaGroupingChoices,
    }
}
