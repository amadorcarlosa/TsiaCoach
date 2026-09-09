import { readonly, ref } from 'vue'
import type { Point } from '~/components/grid/gridPointer'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import {findFreeRodPosition, placementFailure, type RodBoardSpace} from "~/components/rod/movement/rod.placement.ts";
import type {PlacedRod} from "~/components/rod/movement/rod-board.types.ts";


export function useRodBoard(space: RodBoardSpace) {
    const placedRods = ref<PlacedRod[]>([])
    const selectedRodId = ref<string | null>(null)
    const placementMessage = ref('')
    let nextRodId = 1

    function addRod(value: CuisenaireRodValue): string | null {
        const position = findFreeRodPosition(
            value,
            space,
            placedRods.value,
        )

        if (!position) {
            placementMessage.value =
                `No free target space for a ${value}-rod.`
            return null
        }

        const id = `rod-${nextRodId++}`

        placedRods.value.push({
            id,
            value,
            x: position.x,
            y: position.y,
        })

        placementMessage.value = ''
        return id
    }

    function moveRod(id: string, position: Point): boolean {
        const piece = placedRods.value.find(piece => piece.id === id)
        if (!piece) return false

        const failure = placementFailure(
            piece.value,
            position,
            space,
            placedRods.value,
            id,
        )

        if (failure) {
            placementMessage.value = failure === 'occupied'
                ? 'That space is occupied. The rod stayed in its previous position.'
                : 'Keep the whole rod inside the board. The rod stayed in its previous position.'

            return false
        }

        piece.x = position.x
        piece.y = position.y
        placementMessage.value = ''
        return true
    }
    function selectRod(id: string): void {
        if (!placedRods.value.some(piece => piece.id === id)) return

        selectedRodId.value = id
    }

    function clearSelection(): void {
        selectedRodId.value = null
    }

    function removeRod(id: string): void {
        const index = placedRods.value.findIndex(piece => piece.id === id)
        if (index === -1) return

        placedRods.value.splice(index, 1)

        if (selectedRodId.value === id) {
            clearSelection()
        }
        placementMessage.value = ''
    }

    return {
        placedRods: readonly(placedRods),
        selectedRodId: readonly(selectedRodId),
        placementMessage: readonly(placementMessage),
        addRod,
        moveRod,
        selectRod,
        removeRod,
        clearSelection,
    }
   
}