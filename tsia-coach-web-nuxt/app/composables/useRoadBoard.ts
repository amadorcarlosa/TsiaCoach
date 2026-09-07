import { readonly, ref } from 'vue'
import type { Point } from '~/components/grid/gridPointer'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import type { PlacedRod } from '~/components/rod/rod-board.types'

export function useRodBoard() {
    const placedRods = ref<PlacedRod[]>([])
    let nextRodId = 1

    function addRod(
        value: CuisenaireRodValue,
        position: Point,
    ): string {
        const id = `rod-${nextRodId++}`

        placedRods.value.push({
            id,
            value,
            x: position.x,
            y: position.y,
        })

        return id
    }

    function moveRod(id: string, position: Point): void {
        const piece = placedRods.value.find(piece => piece.id === id)
        if (!piece) return

        piece.x = position.x
        piece.y = position.y
    }

    return {
        placedRods: readonly(placedRods),
        addRod,
        moveRod,
    }
}