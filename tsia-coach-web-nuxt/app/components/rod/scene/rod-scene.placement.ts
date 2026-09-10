import type {RodTrain, ScenePolicy, SceneResult} from "~/components/rod/scene/rod.scene.types.ts";


export function validateScene(
    trains: readonly RodTrain[],
    policy: ScenePolicy,
): SceneResult {
    const footprints = trains.flatMap(train =>
        train.parts.map(part => ({
            x: train.anchor.x + part.offset.x,
            y: train.anchor.y + part.offset.y,
            width: part.orientation === 'horizontal' ? part.value : 1,
            depth: part.orientation === 'vertical' ? part.value : 1,
        })),
    )

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

            if (
                a.x < b.x + b.width &&
                a.x + a.width > b.x &&
                a.y < b.y + b.depth &&
                a.y + a.depth > b.y
            ) {
                return {
                    allowed: false,
                    reason: 'That arrangement overlaps another part.',
                }
            }
        }
    }

    return { allowed: true }
}