import { computed } from 'vue'
import type { FactorShape } from '~/components/rod/scene/rod.scene.types'
import type { SceneMenuChoice } from '~/components/rod/scene/scene-menu.types'
import type { useRodScene } from './useRodScene'

const label = 'Create rectangle…'

/** "3 columns × 8 rows — 24 cells" */
export function rectangleShapeLabel(shape: FactorShape): string {
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
  return `${plural(shape.columns, 'column')} × ${plural(shape.rows, 'row')} — ${shape.rows * shape.columns} cells`
}

/**
 * Combines the whole selection into one filled rectangle. Every legal factor
 * shape is offered; `prefer` puts the board's target shapes first, marked
 * suggested, rather than always choosing the most square one.
 */
export function useRectangleMenuChoice(
  scene: ReturnType<typeof useRodScene>,
  prefer?: () => ((shape: FactorShape) => boolean) | undefined,
) {
  return computed<SceneMenuChoice>(() => {
    const ids = [...scene.selection.value]
    if (!ids.length) return { kind: 'submenu', label, children: [], disabledReason: 'Select rods first.' }
    const choices = scene.getRectangleChoices(ids, prefer?.())
    if (!choices.length) {
      const fallback = scene.check(ids, { type: 'make-rectangle', shape: { rows: 1, columns: 1 } })
      return {
        kind: 'submenu',
        label,
        children: [],
        disabledReason: fallback.allowed ? 'This selection cannot form a rectangle.' : fallback.reason,
      }
    }
    const blocked = choices.find(choice => !choice.result.allowed)
    return {
      kind: 'submenu',
      label,
      children: choices.map(({ shape, suggested }) => ({
        kind: 'action' as const,
        label: `${rectangleShapeLabel(shape)}${suggested ? ' (suggested)' : ''}`,
        action: { type: 'make-rectangle' as const, shape },
      })),
      disabledReason: choices.some(choice => choice.result.allowed)
        ? undefined
        : blocked && !blocked.result.allowed ? blocked.result.reason : 'No rectangle fits here.',
    }
  })
}
