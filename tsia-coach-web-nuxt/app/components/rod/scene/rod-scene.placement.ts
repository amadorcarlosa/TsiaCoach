import type {
    MaterialRole,
    Rectangle,
    RodTrain,
    ScenePolicy,
    SceneResult,
} from "~/components/rod/scene/rod.scene.types.ts";
import type { DeepReadonly } from 'vue'
import { trainFitsRegion } from './scene-regions'
import { contains, partFootprint } from './part-footprint'

type Footprint = Rectangle & {
    /** Parts of one train never layer, however their roles are labelled. */
    trainId: string
    /** Null outside the layered region or whenever layering is inactive. */
    role: MaterialRole | null
}

function overlaps(a: Rectangle, b: Rectangle): boolean {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.depth &&
        a.y + a.depth > b.y
    )
}

/**
 * The role a train plays *in this scene*. Three things must hold: the layered
 * activity is active, the train sits in the layered region, and only then does
 * its persisted role count. Central material saved before roles existed meant
 * the selected quantity, so it reads as numerator rather than as tiling.
 */
export function layeredRoleOf(
    train: DeepReadonly<Pick<RodTrain, 'anchor' | 'parts' | 'materialRole'>>,
    policy: ScenePolicy,
): MaterialRole | null {
    const layered = policy.layeredRoles
    if (!layered?.enabled()) return null

    const region = policy.regions?.find(item => item.id === layered.regionId)
    if (!region || !trainFitsRegion(train as RodTrain, region)) return null

    return train.materialRole ?? 'numerator'
}

export function validateScene(
    trains: readonly RodTrain[],
    policy: ScenePolicy,
): SceneResult {
    if (
        policy.requireHorizontalAnchorRow &&
        trains.some(train =>
            train.parts.some(part =>
                part.orientation !== 'horizontal' ||
                part.offset.y !== 0,
            ),
        )
    ) {
        return {
            allowed: false,
            reason: 'Keep every part horizontal and on its train’s anchor row.',
        }
    }

    if (
        policy.regions &&
        trains.some(train => !policy.regions!.some(region => trainFitsRegion(train, region)))
    ) {
        return { allowed: false, reason: 'Keep each train entirely within one compatible region.' }
    }

    const footprints: Footprint[] = trains.flatMap(train => {
        const role = layeredRoleOf(train, policy)

        return train.parts.map(part => ({
            trainId: train.id,
            role,
            ...partFootprint(part, train.anchor),
        }))
    })

    for (const footprint of footprints) {
        const { x, y, width, depth } = footprint

        if (
            !Number.isInteger(x) ||
            !Number.isInteger(y) ||
            x < 0 ||
            y < 0 ||
            x + width > policy.columns ||
            y + depth > policy.rows ||
            (policy.trackRows !== undefined &&
                (depth !== 1 || !policy.trackRows.includes(y)))
        ) {
            return {
                allowed: false,
                reason: 'Keep every part inside the board.',
            }
        }
    }

    for (let i = 0; i < footprints.length; i++) {
        const a = footprints[i]!

        for (let j = i + 1; j < footprints.length; j++) {
            const b = footprints[j]!

            if (!overlaps(a, b)) continue

            // The only permitted overlap: two different pieces of layered
            // central material standing for different mathematical roles.
            // Same train, same role, or anything unlayered still rejects.
            const layered =
                a.trainId !== b.trainId &&
                a.role !== null &&
                b.role !== null &&
                a.role !== b.role

            if (layered) continue

            // Name the roles only when two distinct pieces collide; parts of
            // one malformed train are not a role conflict.
            const sameRole =
                a.trainId !== b.trainId &&
                a.role !== null &&
                a.role === b.role

            return {
                allowed: false,
                reason: sameRole
                    ? `Two ${a.role} pieces cannot share the same cells.`
                    : 'That arrangement overlaps another part.',
            }
        }
    }

    // Containment is a separate rule from stacking: the selected quantity must
    // lie inside the whole it is selected from.
    const layered = policy.layeredRoles

    if (layered?.enabled()) {
        const region = policy.regions?.find(item => item.id === layered.regionId)

        // Role-bearing material belongs to the central array. Dragging it onto
        // a reference track would change what it means by moving it, so the
        // destination is refused rather than silently reinterpreted.
        if (
            region &&
            trains.some(train =>
                train.materialRole !== undefined &&
                !trainFitsRegion(train, region),
            )
        ) {
            return {
                allowed: false,
                reason: 'Denominator tiles and numerator rods belong in the central array.',
            }
        }

        const numerators = trains.filter(
            train => layeredRoleOf(train, policy) === 'numerator',
        )

        if (numerators.length) {
            const whole = layered.wholeOf(trains)

            if (!whole) {
                return {
                    allowed: false,
                    reason: 'Define the whole with both D references before placing numerator rods.',
                }
            }

            const outside = numerators.some(train =>
                train.parts.some(part => !contains(whole, partFootprint(part, train.anchor))),
            )

            if (outside) {
                return {
                    allowed: false,
                    reason:
                        `Numerator rods must stay inside the ${whole.width} × ${whole.depth} whole. ` +
                        'Move them first, then change the references.',
                }
            }
        }
    }

    return { allowed: true }
}
