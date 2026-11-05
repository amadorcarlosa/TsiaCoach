import type { DeepReadonly } from 'vue'
import type { RodTrain, TrainPart } from '~/components/rod/scene/rod.scene.types'
import { trainFitsRegion } from '~/components/rod/scene/scene-regions'
import { partFootprint } from '~/components/rod/scene/part-footprint'
import { evaluateSystem } from './systems.evaluate'
import { rowParts } from './systems.operations'
import { systemsGeometry } from './systems.geometry'
import { variableIds, type SystemsBoardConfig, type VariableId } from './systems.schema'

/** Only complete learner regions establish values; generated rows are never sources. */
export function substituteSystem(config: SystemsBoardConfig, sources: readonly DeepReadonly<RodTrain>[]) {
  const geometry = systemsGeometry(config)
  const suggestions: RodTrain[] = []
  const candidates: Partial<Record<VariableId, number>> = {}
  const lines: string[] = []
  const sourceEvaluation = evaluateSystem(config, sources)
  const result = () => ({
    candidates, suggestions, lines,
    evaluation: evaluateSystem(config, [...sources, ...suggestions]),
  })
  if (!sourceEvaluation.valid) {
    lines.push(sourceEvaluation.reason)
    return result()
  }

  const rows = geometry.variableRegions.map(region => {
    const lanes: { x: number; value: TrainPart['value'] }[][] =
      Array.from({ length: region.depth }, () => [])
    let prototyping = false
    for (const train of sources.filter(train => trainFitsRegion(train, region))) {
      for (const part of train.parts) {
        if (part.orientation !== 'horizontal') {
          prototyping = true
          continue
        }
        const bounds = partFootprint(part, train.anchor)
        lanes[bounds.y - region.y]!.push({ x: bounds.x, value: part.value })
      }
    }
    // Scene validation has already ruled out overlaps. A lane is contiguous
    // when its occupied length equals the span from its first to last cell.
    const spans = lanes.map(lane => {
      if (!lane.length) return null
      const x = Math.min(...lane.map(part => part.x))
      const end = Math.max(...lane.map(part => part.x + part.value))
      const length = lane.reduce((sum, part) => sum + part.value, 0)
      return { x, length, contiguous: end - x === length }
    })
    const complete = !prototyping &&
      spans.every(span => span?.contiguous && span.length === spans[0]?.length && span.x === spans[0]?.x)
    return { region, spans, complete, prototyping }
  })

  for (const variable of variableIds) {
    const groups = rows.filter(row => row.region.variable === variable)
    const completed = groups.filter(group => group.complete)
    if (!completed.length) continue
    const value = completed[0]!.spans[0]!.length
    if (completed.some(group => group.spans[0]!.length !== value)) {
      lines.push(`Cannot propagate ${variable}: the completed learner regions show different values.`)
      continue
    }
    candidates[variable] = value
    const origin = completed[0]!
    lines.push(`${variable} = ${value} established from Equation ${origin.region.equationIndex + 1}.`)
    for (const { region, spans, complete, prototyping } of groups) {
      if (complete) continue
      const occupied = spans.filter(span => span !== null)
      const start = occupied[0]?.x ?? region.x
      if (prototyping || start + value > region.x + region.width || occupied.some(span => !span.contiguous || span.length !== value || span.x !== start)) {
        lines.push(`Equation ${region.equationIndex + 1}'s ${variable} region contains different or extra learner rods. Nothing there was replaced.`)
        continue
      }
      spans.forEach((span, index) => {
        if (span) return
        suggestions.push({
          id: `suggested:${region.id}:${index}`,
          anchor: { x: start, y: region.y + index },
          parts: rowParts(value),
        })
      })
      lines.push(`Equation ${region.equationIndex + 1}'s ${region.coefficient}${variable} region was completed using the same value (${region.coefficient} × ${value} = ${region.coefficient * value}).`)
    }
  }
  if (!Object.keys(candidates).length) lines.push('Complete a coefficient region with equal-length, contiguous material in each aligned row to establish a variable value.')
  return result()
}
