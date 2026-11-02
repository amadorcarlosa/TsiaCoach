import type { DeepReadonly } from 'vue'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import type { BoardTransform, RodTrain, TrainPart } from '~/components/rod/scene/rod.scene.types'
import { partFootprint } from '~/components/rod/scene/part-footprint'
import { trainMagnitude } from '~/components/rod/scene/rod-arithmetic'
import { copyScene } from '~/components/rod/scene/scene-snapshot'
import { trainFitsRegion } from '~/components/rod/scene/scene-regions'
import { evaluateSystem } from './systems.evaluate'
import { systemsGeometry, type SystemsGeometry, type VariableRegion } from './systems.geometry'
import type { SystemsBoardConfig, VariableId } from './systems.schema'

/**
 * Pure planners for the systems context-menu commands. They read a snapshot
 * and return what to remove and add plus a description; they own no DOM, IDs
 * or scene state. The scene runs them again at commit, against current data.
 */

export type SystemsTransformName = 'repeat-row' | 'arrange-rows' | 'redistribute' | 'test-candidate'

export type SystemsTransform = BoardTransform & { name: SystemsTransformName }

export type SystemsPlan = {
  remove: readonly string[]
  /** New row trains, IDs assigned by the scene at commit. */
  add: RodTrain[]
  title: string
  lines: readonly string[]
  /** True only when the planner proved the intended area is unchanged. */
  conserves: boolean
  /** Canonical inputs, for the stale-preview check. */
  key: string
}

export type SystemsPlanResult = { allowed: true; plan: SystemsPlan } | { allowed: false; reason: string }

type Snapshot = readonly DeepReadonly<RodTrain>[]

export const systemsReasons = {
  oneRow: 'Select one row train.',
  makeTrain: 'Make a train first, so the row is one object.',
  inGroup: 'Select a row inside an x or y group.',
  notRow: 'Lay the row flat in one lane first.',
  oneGroup: 'Select rods from one variable group.',
  oneEquation: 'Select rods from one equation.',
  occupied: 'The destination already contains material. Move or delete it first.',
  stale: 'The rods changed. Open the preview again.',
  unknown: 'Unknown systems command.',
} as const

const reject = (reason: string): SystemsPlanResult => ({ allowed: false, reason })

/** Rod parts for one row of any positive length: tens, then the remainder. */
export function rowParts(length: number): TrainPart[] {
  if (!Number.isInteger(length) || length < 1) throw new RangeError(`No row has length ${length}.`)
  const parts: TrainPart[] = []
  let offset = 0
  while (offset < length) {
    const value = Math.min(10, length - offset) as CuisenaireRodValue
    parts.push({ value, offset: { x: offset, y: 0 }, orientation: 'horizontal' })
    offset += value
  }
  return parts
}

function rowTrain(region: VariableRegion, lane: number, start: number, parts: TrainPart[]): RodTrain {
  return {
    id: '',
    anchor: { x: region.x + start, y: region.y + lane },
    parts: parts.map(part => ({ ...part, offset: { ...part.offset } })),
  }
}

const rectangleRows = (region: VariableRegion, start: number, length: number) =>
  Array.from({ length: region.coefficient }, (_, lane) => rowTrain(region, lane, start, rowParts(length)))

function cells(trains: readonly DeepReadonly<RodTrain>[]): Set<string> {
  const out = new Set<string>()
  for (const train of trains) for (const part of train.parts) {
    const box = partFootprint(part, train.anchor)
    for (let y = box.y; y < box.y + box.depth; y++) for (let x = box.x; x < box.x + box.width; x++) out.add(`${x},${y}`)
  }
  return out
}

const area = (trains: Snapshot) => trains.reduce((sum, train) => sum + trainMagnitude(train), 0)

function inRegion(trains: Snapshot, region: VariableRegion) {
  return trains.filter(train => trainFitsRegion(train, region))
}

/** Canonical form of the material in the given regions. */
function regionKey(trains: Snapshot, regions: readonly VariableRegion[], extra: unknown): string {
  const ids = new Set(regions.flatMap(region => inRegion(trains, region).map(train => train.id)))
  const inputs = trains.filter(train => ids.has(train.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return JSON.stringify([copyScene(inputs), extra])
}

function selectionRegions(geometry: SystemsGeometry, trains: Snapshot, ids: readonly string[]) {
  const selected = ids.map(id => trains.find(train => train.id === id))
  if (!selected.length || selected.some(train => !train)) return null
  return (selected as DeepReadonly<RodTrain>[]).map(train => ({
    train,
    region: geometry.variableRegions.find(region => trainFitsRegion(train, region)) ?? null,
  }))
}

const regionsOf = (geometry: SystemsGeometry, equationId: string) =>
  (['x', 'y'] as const).map(variable =>
    geometry.variableRegions.find(region => region.equationId === equationId && region.variable === variable)!)

const rows = (count: number) => `${count} ${count === 1 ? 'row' : 'rows'}`

/** Single-equation area-preserving pairs. Never ranked against the other equation. */
export function redistributionPairs(a: number, b: number, total: number, maxLength: number): [number, number][] {
  const pairs: [number, number][] = []
  for (let x = 1; x <= maxLength; x++) {
    const rest = total - a * x
    if (rest < b) break
    if (rest % b === 0 && rest / b <= maxLength) pairs.push([x, rest / b])
  }
  return pairs
}

/** The equation a selection belongs to, with its area and every positive split. */
export function redistributionOptions(config: SystemsBoardConfig, trains: Snapshot, ids: readonly string[]) {
  const geometry = systemsGeometry(config)
  const selection = selectionRegions(geometry, trains, ids)
  if (!selection || selection.some(item => !item.region)) return { allowed: false as const, reason: systemsReasons.oneEquation }
  const equationIds = new Set(selection.map(item => item.region!.equationId))
  if (equationIds.size !== 1) return { allowed: false as const, reason: systemsReasons.oneEquation }
  const equationId = [...equationIds][0]!
  const index = config.system.equations.findIndex(equation => equation.id === equationId)
  const equation = config.system.equations[index]!
  const [xRegion, yRegion] = regionsOf(geometry, equationId)
  const total = area(inRegion(trains, xRegion!)) + area(inRegion(trains, yRegion!))
  const pairs = redistributionPairs(equation.coefficients.x, equation.coefficients.y, total, config.laneColumns)
  if (!pairs.length) {
    return {
      allowed: false as const,
      reason: `Equation ${index + 1} has ${total} cells; they cannot make ${rows(equation.coefficients.x)} and ` +
        `${rows(equation.coefficients.y)} of positive whole-number lengths.`,
    }
  }
  return { allowed: true as const, equationId, index, total, pairs }
}

export function planSystemsTransform(
  config: SystemsBoardConfig,
  trains: Snapshot,
  ids: readonly string[],
  transform: BoardTransform,
): SystemsPlanResult {
  const geometry = systemsGeometry(config)
  // The key names the command, not the expectation it is checked against.
  const command: BoardTransform = { name: transform.name, ...(transform.params ? { params: { ...transform.params } } : {}) }
  const result = plan(config, geometry, trains, ids, command)
  if (result.allowed && transform.expected !== undefined && transform.expected !== result.plan.key) {
    return reject(systemsReasons.stale)
  }
  return result
}

function plan(
  config: SystemsBoardConfig,
  geometry: SystemsGeometry,
  trains: Snapshot,
  ids: readonly string[],
  transform: BoardTransform,
): SystemsPlanResult {
  const selection = selectionRegions(geometry, trains, ids)
  if (!selection) return reject('Select existing rods first.')

  switch (transform.name) {
    case 'repeat-row': {
      if (selection.length !== 1) return reject(selection.length > 1 ? systemsReasons.makeTrain : systemsReasons.oneRow)
      const { train, region } = selection[0]!
      if (!region) return reject(systemsReasons.inGroup)
      if (train.parts.some(part => part.orientation !== 'horizontal' || part.offset.y !== 0)) {
        return reject(systemsReasons.notRow)
      }
      const length = trainMagnitude(train)
      const start = train.anchor.x - region.x
      const lane = train.anchor.y - region.y
      if (region.coefficient === 1) return reject('This group has one row, and the row is already there.')

      const parts = copyScene([train])[0]!.parts
      const added = Array.from({ length: region.coefficient }, (_, row) => rowTrain(region, row, start, parts))
      const others = inRegion(trains, region).filter(item => item.id !== train.id)
      const taken = cells(others)
      if ([...cells(added)].some(cell => taken.has(cell))) return reject(systemsReasons.occupied)

      const change = (region.coefficient - 1) * length
      return {
        allowed: true,
        plan: {
          remove: [train.id],
          add: added,
          title: 'Repeat row into this group',
          lines: [
            `Make ${rows(region.coefficient)} of ${length} in ${region.label.toLowerCase()}, each like the selected row.`,
            `The row in lane ${lane + 1} stays; this adds ${change} cells to the equation.`,
          ],
          conserves: false,
          key: regionKey(trains, [region], transform),
        },
      }
    }

    case 'arrange-rows': {
      const regions = new Set(selection.map(item => item.region))
      if (regions.size !== 1 || !selection[0]!.region) return reject(systemsReasons.oneGroup)
      const region = selection[0]!.region
      const material = inRegion(trains, region)
      const total = area(material)
      if (total % region.coefficient !== 0) {
        return reject(
          `This group has ${total} cells; ${total} cannot form ${region.coefficient} equal whole-number rows.`)
      }
      const length = total / region.coefficient
      if (length > config.laneColumns) return reject(`Rows of ${length} would not fit in ${config.laneColumns} columns.`)

      const evaluation = evaluateSystem(config, trains)
      const group = evaluation.valid
        ? evaluation.equations.flatMap(equation => [equation.groups.x, equation.groups.y])
          .find(item => item.regionId === region.id)
        : undefined
      if (group?.status === 'rectangle') return reject(`This group already forms ${rows(region.coefficient)} of ${length}.`)

      const occupied = material.flatMap(train => train.parts.map(part => train.anchor.x + part.offset.x - region.x))
      const preferred = Math.min(...occupied)
      const start = preferred + length <= config.laneColumns ? preferred : 0
      return {
        allowed: true,
        plan: {
          remove: material.map(train => train.id),
          add: rectangleRows(region, start, length),
          title: 'Arrange as coefficient rows',
          lines: [
            `Rearrange the ${total} cells of ${region.label.toLowerCase()} into ${rows(region.coefficient)} of ${length}.`,
            'The group keeps its area.',
          ],
          conserves: true,
          key: regionKey(trains, [region], transform),
        },
      }
    }

    case 'redistribute': {
      const options = redistributionOptions(config, trains, ids)
      if (!options.allowed) return options
      const x = transform.params?.x
      const y = transform.params?.y
      if (!options.pairs.some(pair => pair[0] === x && pair[1] === y)) {
        return reject('Choose one of the listed arrangements for this equation.')
      }
      const [xRegion, yRegion] = regionsOf(geometry, options.equationId)
      const evaluation = evaluateSystem(config, trains)
      const equation = evaluation.valid ? evaluation.equations[options.index] : undefined
      if (equation && equation.groups.x.length === x && equation.groups.y.length === y) {
        return reject('The equation already shows this arrangement.')
      }
      const removed = [...inRegion(trains, xRegion!), ...inRegion(trains, yRegion!)]
      return {
        allowed: true,
        plan: {
          remove: removed.map(train => train.id),
          add: [...rectangleRows(xRegion!, 0, x!), ...rectangleRows(yRegion!, 0, y!)],
          title: 'Redistribute this equation’s area',
          lines: [
            `Rearrange Equation ${options.index + 1}’s ${options.total} cells as ` +
              `${rows(xRegion!.coefficient)} of ${x} and ${rows(yRegion!.coefficient)} of ${y}.`,
            'The equation keeps its area. The other equation is unchanged.',
          ],
          conserves: true,
          key: regionKey(trains, [xRegion!, yRegion!], transform),
        },
      }
    }

    case 'test-candidate': {
      if (selection.some(item => !item.region)) return reject(systemsReasons.oneEquation)
      const equationIds = new Set(selection.map(item => item.region!.equationId))
      if (equationIds.size !== 1) return reject(systemsReasons.oneEquation)
      const sourceId = [...equationIds][0]!
      const evaluation = evaluateSystem(config, trains)
      if (!evaluation.valid) return reject(evaluation.reason)
      const source = evaluation.equations.find(equation => equation.equationId === sourceId)!
      const x = source.groups.x.length
      const y = source.groups.y.length
      if (x === null || y === null) return reject('Build both groups of this equation as rectangles first.')

      const target = config.system.equations.find(equation => equation.id !== sourceId)!
      const targetIndex = config.system.equations.indexOf(target)
      const [xRegion, yRegion] = regionsOf(geometry, target.id)
      const removed = [...inRegion(trains, xRegion!), ...inRegion(trains, yRegion!)]
      const built = target.coefficients.x * x + target.coefficients.y * y
      const difference = built - target.targetArea
      const outcome = difference > 0 ? `${difference} excess` : difference < 0 ? `${-difference} missing` : 'an exact match'
      return {
        allowed: true,
        plan: {
          remove: removed.map(train => train.id),
          add: [...rectangleRows(xRegion!, 0, x), ...rectangleRows(yRegion!, 0, y)],
          title: 'Test candidate in other equation',
          lines: [
            `Build x = ${x} and y = ${y} in Equation ${targetIndex + 1}: ` +
              `${rows(target.coefficients.x)} of ${x} and ${rows(target.coefficients.y)} of ${y}.`,
            `Equation ${targetIndex + 1} would have ${built} of ${target.targetArea} cells: ${outcome}.`,
            removed.length
              ? `This replaces ${removed.length} ${removed.length === 1 ? 'train' : 'trains'} (${area(removed)} cells) now in Equation ${targetIndex + 1}.`
              : `Equation ${targetIndex + 1} is empty now, so nothing is replaced.`,
            `Equation ${source.index + 1} is unchanged.`,
          ],
          conserves: false,
          key: regionKey(trains, [...regionsOf(geometry, sourceId), xRegion!, yRegion!], transform),
        },
      }
    }

    default:
      return reject(systemsReasons.unknown)
  }
}

/** Which variable groups exist for a region id, for menus. */
export function variableOfRegion(geometry: SystemsGeometry, regionId: string): VariableId | null {
  return geometry.variableRegions.find(region => region.id === regionId)?.variable ?? null
}
