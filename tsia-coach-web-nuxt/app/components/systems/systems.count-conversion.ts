import type { DeepReadonly } from 'vue'
import type { FactorShape, RodTrain } from '~/components/rod/scene/rod.scene.types'
import { partFootprint } from '~/components/rod/scene/part-footprint'
import { partSign } from '~/components/rod/scene/rod-arithmetic'
import { tiledRectangle } from '~/components/tabla/area-grouping'
import type { ExchangeStep } from './systems.candidates'

/**
 * Pure reading of a conversion workspace: the editable draft material only.
 * It never changes the confirmed candidate; it says whether the material is
 * exactly the exchange's target groups yet, and why not.
 */

type Snapshot = readonly DeepReadonly<RodTrain>[]

export type ConversionAssessment = {
  /** Cells of editable material. */
  area: number
  /** Cells this exchange converts: removedX × a = addedY × b. */
  required: number
  /** "8 groups of 3", when the material reads as equal groups. */
  grouping: string | null
  /** "3 groups of 8" */
  target: string
  /** Board cells of the finished upright y rods, when ready. */
  placements: readonly { x: number; y: number }[]
  ready: boolean
  /** Why Apply is unavailable, or the next step. */
  reason: string
  /** "24 cells being converted: 8 groups of 3 → 3 groups of 8" */
  summary: string
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** "8 groups of 3" when every part is the same rod value. */
function equalGroups(material: Snapshot): string | null {
  const parts = material.flatMap(train => train.parts)
  if (!parts.length) return null
  const values = new Set(parts.map(part => part.value))
  if (values.size !== 1) return null
  return `${plural(parts.length, 'group')} of ${parts[0]!.value}`
}

/** The target shape a rectangle should take so its columns are the new y rods. */
export function targetShape(step: ExchangeStep, b: number): FactorShape {
  return { rows: b, columns: step.addedY }
}

export function assessConversion(step: ExchangeStep, coefficients: { x: number; y: number }, material: Snapshot): ConversionAssessment {
  const { y: b } = coefficients
  const required = step.preservedArea
  const parts = material.flatMap(train => train.parts.map(part => ({ part, train })))
  const area = parts.reduce((sum, { part }) => sum + part.value, 0)
  const grouping = equalGroups(material)
  const target = `${plural(step.addedY, 'group')} of ${b}`
  const summary = `${area} cells being converted: ${grouping ?? 'mixed rods'} → ${target}`
  const result = (ready: boolean, reason: string, placements: { x: number; y: number }[] = []): ConversionAssessment =>
    ({ area, required, grouping, target, placements, ready, reason, summary })

  if (!parts.length) return result(false, `The workspace is empty; this exchange requires ${required} cells.`)
  if (parts.some(({ part }) => partSign(part) === -1)) return result(false, 'Negative rods cannot finish this conversion.')
  if (area !== required) return result(false, `${area} cells in workspace; this exchange requires ${required}.`)
  if (parts.some(({ part }) => part.orientation === 'tower')) return result(false, 'Lay the tower down: a conversion uses lying or upright rods.')

  const finished = parts.every(({ part }) => part.value === b && part.orientation === 'vertical')
  if (finished && parts.length === step.addedY) {
    return result(true, `Ready: ${target}, standing as ${plural(step.addedY, 'y rod')}.`,
      parts.map(({ part, train }) => {
        const box = partFootprint(part, train.anchor)
        return { x: box.x, y: box.y }
      }).sort((p, q) => p.x - q.x || p.y - q.y))
  }
  if (parts.every(({ part }) => part.value === b) && parts.length === step.addedY) {
    return result(false, `Stand the ${plural(step.addedY, `${b}-rod`)} upright to finish.`)
  }
  const rectangle = material.length === 1 ? tiledRectangle(material[0]!) : null
  if (rectangle) {
    const shape = targetShape(step, b)
    if (rectangle.width === shape.columns && rectangle.depth === shape.rows) {
      return result(false, `Group the rectangle as ${target} (vertical columns).`)
    }
    return result(false, `This ${rectangle.width} × ${rectangle.depth} rectangle has no ${target} in columns. Make a ${shape.columns} columns × ${shape.rows} rows rectangle.`)
  }
  return result(false, `Create a rectangle from the ${required} cells, then group it as ${target}.`)
}
