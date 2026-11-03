import type { DeepReadonly } from 'vue'
import type { RodTrain, TrainPart } from '~/components/rod/scene/rod.scene.types'
import { trainFitsRegion } from '~/components/rod/scene/scene-regions'
import { partFootprint } from '~/components/rod/scene/part-footprint'
import { evaluateSystem } from './systems.evaluate'
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
    const complete = !prototyping && lanes.every(lane => lane.length === 1) &&
      new Set(lanes.map(lane => lane[0]?.value)).size === 1 &&
      new Set(lanes.map(lane => lane[0]?.x)).size === 1
    return { region, lanes, complete, prototyping }
  })

  for (const variable of variableIds) {
    const groups = rows.filter(row => row.region.variable === variable)
    const completed = groups.filter(group => group.complete)
    if (!completed.length) continue
    const value = completed[0]!.lanes[0]![0]!.value
    if (completed.some(group => group.lanes[0]![0]!.value !== value)) {
      lines.push(`Cannot propagate ${variable}: the completed learner regions show different values.`)
      continue
    }
    candidates[variable] = value
    const origin = completed[0]!
    lines.push(`${variable} = ${value} established from Equation ${origin.region.equationIndex + 1}.`)
    for (const { region, lanes, complete, prototyping } of groups) {
      if (complete) continue
      const occupied = lanes.filter(lane => lane.length)
      const start = occupied[0]?.[0]?.x ?? region.x
      if (prototyping || occupied.some(lane => lane.length !== 1 || lane[0]!.value !== value || lane[0]!.x !== start)) {
        lines.push(`Equation ${region.equationIndex + 1}'s ${variable} region contains different or extra learner rods. Nothing there was replaced.`)
        continue
      }
      lanes.forEach((lane, index) => {
        if (lane.length) return
        suggestions.push({
          id: `suggested:${region.id}:${index}`,
          anchor: { x: start, y: region.y + index },
          parts: [{ value, orientation: 'horizontal', offset: { x: 0, y: 0 } }],
        })
      })
      lines.push(`Equation ${region.equationIndex + 1}'s ${region.coefficient}${variable} region was completed using the same value (${region.coefficient} × ${value} = ${region.coefficient * value}).`)
    }
  }
  if (!Object.keys(candidates).length) lines.push('Complete a coefficient region with exactly one equal-length rod in each aligned row to establish a variable value.')
  return result()
}
