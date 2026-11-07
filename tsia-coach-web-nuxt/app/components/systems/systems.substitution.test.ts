import { describe, expect, it } from 'vitest'
import type { RodTrain, TrainPart } from '~/components/rod/scene/rod.scene.types'
import { trainFitsRegion } from '~/components/rod/scene/scene-regions'
import type { SystemsBoardConfig } from './systems.schema'
import { rowParts } from './systems.operations'
import { substituteSystem } from './systems.substitution'
import { systemsFixtures } from './systems.fixtures'
import { systemsGeometry } from './systems.geometry'

const config = systemsFixtures.development.config
const regions = systemsGeometry(config).variableRegions
function rows(regionIndex: number, value: TrainPart['value'] = 3): RodTrain[] {
  const region = regions[regionIndex]!
  return Array.from({ length: region.depth }, (_, row) => ({
    id: `${region.id}:${row}`,
    anchor: { x: region.x, y: region.y + row },
    parts: [{ value, orientation: 'horizontal', offset: { x: 0, y: 0 } }],
  }))
}

describe('completed coefficient region propagation', () => {
  it.each([0, 1, 2, 3])('propagates only the established variable from region %i', index => {
    const value = index % 2 === 0 ? 3 : 5
    const sources = rows(index, value)
    const before = JSON.stringify(sources)
    const result = substituteSystem(config, sources)
    const variable = regions[index]!.variable
    const target = regions[(index + 2) % 4]!
    expect(result.candidates).toEqual({ [variable]: value })
    expect(result.suggestions).toHaveLength(target.depth)
    expect(result.suggestions.every(train => trainFitsRegion(train, target))).toBe(true)
    expect(result.suggestions.every(train => train.parts[0]!.value === value)).toBe(true)
    expect(result.evaluation.valid && result.evaluation.satisfied).toBe(false)
    expect(result.lines.join(' ')).toContain(`${variable} = ${value} established from Equation ${Math.floor(index / 2) + 1}`)
    expect(JSON.stringify(sources)).toBe(before)
  })

  it('does not propagate a single row or an incomplete region', () => {
    for (const sources of [[], rows(0).slice(0, 1), rows(0).slice(0, 2)]) {
      expect(substituteSystem(config, sources).suggestions).toEqual([])
      expect(substituteSystem(config, sources).candidates).toEqual({})
    }
  })

  it('removes generated rows when source completion is broken and updates them on equal-length changes', () => {
    const sources = rows(0)
    expect(substituteSystem(config, sources).suggestions).toHaveLength(4)
    sources[0]!.parts[0]!.value = 8
    expect(substituteSystem(config, sources).suggestions).toHaveLength(0)
    for (const train of sources) train.parts[0]!.value = 8
    const changed = substituteSystem(config, sources)
    expect(changed.candidates).toEqual({ x: 8 })
    expect(changed.suggestions).toHaveLength(4)
    expect(changed.suggestions.every(train => train.parts[0]!.value === 8)).toBe(true)
    sources.pop()
    expect(substituteSystem(config, sources).suggestions).toHaveLength(0)
  })

  it('rejects gaps, extra rods, misalignment and overlaps as completed regions', () => {
    const extra = rows(0)
    extra[0]!.parts.push({ value: 3, orientation: 'horizontal', offset: { x: 3, y: 0 } })
    expect(substituteSystem(config, extra).suggestions).toHaveLength(0)
    extra[0]!.parts[1]!.offset.x = 5
    expect(substituteSystem(config, extra).suggestions).toHaveLength(0)
    const shifted = rows(0)
    shifted[0]!.anchor.x++
    expect(substituteSystem(config, shifted).suggestions).toHaveLength(0)
    const overlap = rows(0)
    overlap.push({ ...overlap[0]!, id: 'overlap' })
    const invalid = substituteSystem(config, overlap)
    expect(invalid.suggestions).toHaveLength(0)
    expect(invalid.lines).toContain('Two rods share the same cells.')
  })

  it('preserves compatible partial target material and fills only empty target rows', () => {
    const sources = [...rows(0), rows(2)[0]!]
    const result = substituteSystem(config, sources)
    expect(result.suggestions).toHaveLength(3)
    expect(result.evaluation.valid && result.evaluation.equations[1].groups.x.occupiedArea).toBe(12)
    expect(sources).toHaveLength(4)
  })

  it('does not overwrite incompatible target rods or propagate conflicting completed regions', () => {
    const partial = substituteSystem(config, [...rows(0), rows(2, 8)[0]!])
    expect(partial.suggestions).toHaveLength(0)
    expect(partial.lines.join(' ')).toContain('Nothing there was replaced')
    const conflict = substituteSystem(config, [...rows(0), ...rows(2, 8)])
    expect(conflict.candidates).toEqual({})
    expect(conflict.suggestions).toHaveLength(0)
    expect(conflict.lines.join(' ')).toContain('completed learner regions show different values')
  })

  it('lets learners establish each variable independently without solving either one', () => {
    const result = substituteSystem(config, [...rows(0), ...rows(1, 5)])
    expect(result.candidates).toEqual({ x: 3, y: 5 })
    expect(result.suggestions).toHaveLength(6)
    expect(result.evaluation.valid && result.evaluation.satisfied).toBe(true)
  })
})

it('propagates x = 14 as a 10 + 4 train and completes the long-variable system', () => {
  const config = systemsFixtures.longVariable.config
  const [x, y, target] = systemsGeometry(config).variableRegions
  const sources: RodTrain[] = [0, 1].map(row => ({
    id: `x-${row}`,
    anchor: { x: x!.x, y: x!.y + row },
    parts: [
      { value: 10, orientation: 'horizontal', offset: { x: 0, y: 0 } },
      { value: 4, orientation: 'horizontal', offset: { x: 10, y: 0 } },
    ],
  }))
  sources.push({
    id: 'y',
    anchor: { x: y!.x, y: y!.y },
    parts: [{ value: 4, orientation: 'horizontal', offset: { x: 0, y: 0 } }],
  })
  const result = substituteSystem(config, sources)
  expect(result.candidates).toEqual({ x: 14, y: 4 })
  expect(result.suggestions.find(train => trainFitsRegion(train, target!))?.parts.map(part => part.value)).toEqual([10, 4])
  expect(result.evaluation.valid && result.evaluation.satisfied).toBe(true)
})


it.each([14, 27, 65])('substitutes arbitrary configured equations with variable length %i', x => {
  const y = 6
  const config: SystemsBoardConfig = {
    layout: 'continuous' as const, staging: false, laneColumns: 100, regionGapRows: 1,
    system: { equations: [
      { id: 'custom-a', coefficients: { x: 3, y: 2 }, targetArea: 3 * x + 2 * y },
      { id: 'custom-b', coefficients: { x: 2, y: 5 }, targetArea: 2 * x + 5 * y },
    ] },
  }
  const sources = systemsGeometry(config).variableRegions.filter(region => region.equationIndex === 0)
    .flatMap(region => Array.from({ length: region.coefficient }, (_, lane): RodTrain => ({
      id: `${region.id}-${lane}`, anchor: { x: region.x, y: region.y + lane },
      parts: rowParts(region.variable === 'x' ? x : y),
    })))
  const result = substituteSystem(config, sources)
  expect(result.candidates).toEqual({ x, y })
  expect(result.suggestions).toHaveLength(7)
  expect(result.suggestions.every(train => train.parts.every(part => part.value >= 1 && part.value <= 10))).toBe(true)
  expect(result.evaluation.valid && result.evaluation.satisfied).toBe(true)
})
