import { computed, readonly, ref } from 'vue'
import type { Point } from '~/components/grid/gridPointer'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import {type ArrayBoardSpace, canPlaceArrayRod} from "~/components/rod/array/array-rod.placement.ts";
import type {ArrayRod, ArrayRodOrientation} from "~/components/rod/array/array-rod.types.ts";


export function useArrayRodBoard(space: ArrayBoardSpace) {
    const pieces = ref<ArrayRod[]>([])
    const selectedRodId = ref<string | null>(null)
    const message = ref('')
    let nextId = 1

    const selectedRod = computed(() =>
        pieces.value.find(piece => piece.id === selectedRodId.value),
    )

    function selectRod(id: string): void {
        if (pieces.value.some(piece => piece.id === id)) {
            selectedRodId.value = id
        }
    }

    function addRod(value: CuisenaireRodValue): string | null {
        const id = `array-rod-${nextId}`

        // New rods start horizontally, scanning every array row.
        for (let y = 0; y < space.rows; y++) {
            for (let x = 0; x <= space.columns - value; x++) {
                const candidate: ArrayRod = {
                    id,
                    value,
                    orientation: 'horizontal',
                    x,
                    y,
                }

                if (!canPlaceArrayRod(candidate, pieces.value, space)) continue

                nextId++
                pieces.value.push(candidate)
                selectedRodId.value = id
                message.value = ''
                return id
            }
        }

        message.value = `No room for a horizontal ${value}-rod.`
        return null
    }

    function commit(candidate: ArrayRod): boolean {
        const index = pieces.value.findIndex(
            piece => piece.id === candidate.id,
        )
        if (index === -1) return false

        if (!canPlaceArrayRod(candidate, pieces.value, space)) {
            message.value =
                'That position or orientation overlaps another rod or leaves the board.'
            return false
        }

        pieces.value[index] = candidate
        message.value = ''
        return true
    }

    function moveRod(id: string, position: Point): boolean {
        const piece = pieces.value.find(piece => piece.id === id)
        if (!piece) return false

        return commit({ ...piece, x: position.x, y: position.y })
    }

    function orientRod(
        id: string,
        orientation: ArrayRodOrientation,
    ): boolean {
        const piece = pieces.value.find(piece => piece.id === id)
        if (!piece) return false

        // Keep the same top-left anchor when changing orientation.
        return commit({ ...piece, orientation })
    }

    function removeRod(id: string): void {
        const index = pieces.value.findIndex(piece => piece.id === id)
        if (index === -1) return

        pieces.value.splice(index, 1)
        if (selectedRodId.value === id) selectedRodId.value = null
        message.value = ''
    }

    return {
        pieces: readonly(pieces),
        selectedRodId: readonly(selectedRodId),
        selectedRod: readonly(selectedRod),
        message: readonly(message),
        addRod,
        moveRod,
        orientRod,
        selectRod,
        removeRod,
    }
}