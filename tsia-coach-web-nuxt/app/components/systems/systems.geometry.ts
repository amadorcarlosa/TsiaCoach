import type { SceneRegion } from '~/components/rod/scene/rod.scene.types'
import type { LinearEquation, SystemsBoardConfig, VariableId } from './systems.schema'
import { variableIds } from './systems.schema'

/** Columns left of the lanes for coefficient brackets. Never editable cells. */
export const SYSTEMS_GUTTER_COLUMNS = 4
/** Loose material lives here and counts toward no equation. */
export const STAGING_ROWS = 4
export const STAGING_REGION_ID = 'staging'

export type VariableRegion = SceneRegion & {
  kind: 'variable'
  equationId: string
  equationIndex: number
  variable: VariableId
  /** Lane count. A layout fact, never a rod value. */
  coefficient: number
  label: string
}

export type StagingRegion = SceneRegion & { kind: 'staging'; label: string }

export type SystemsGeometry = {
  columns: number
  rows: number
  variableRegions: readonly VariableRegion[]
  staging: StagingRegion
  /** Every region, in the order the scene policy checks them. */
  regions: readonly SceneRegion[]
  /** Heading rows above each band, for equation text and status. */
  headings: readonly { equationId: string; equationIndex: number; row: number }[]
  stagingHeadingRow: number
}

export const variableRegionId = (equationId: string, variable: VariableId) => `${equationId}:${variable}`

export const equationText = (equation: LinearEquation) => {
  const term = (coefficient: number, variable: VariableId) =>
    `${coefficient === 1 ? '' : coefficient}${variable}`
  return `${term(equation.coefficients.x, 'x')} + ${term(equation.coefficients.y, 'y')} = ${equation.targetArea}`
}

/**
 * Pure layout. Each equation is a band: a heading row, its x lanes, one
 * separator row, then its y lanes. Staging follows the last band.
 */
export function systemsGeometry(config: SystemsBoardConfig): SystemsGeometry {
  const x = SYSTEMS_GUTTER_COLUMNS
  const width = config.laneColumns
  const variableRegions: VariableRegion[] = []
  const headings: { equationId: string; equationIndex: number; row: number }[] = []
  let row = 0

  config.system.equations.forEach((equation, equationIndex) => {
    headings.push({ equationId: equation.id, equationIndex, row })
    row += config.regionGapRows
    variableIds.forEach((variable, index) => {
      if (index > 0) row += 1
      const coefficient = equation.coefficients[variable]
      variableRegions.push({
        kind: 'variable',
        id: variableRegionId(equation.id, variable),
        equationId: equation.id,
        equationIndex,
        variable,
        coefficient,
        label: `Equation ${equationIndex + 1}, ${coefficient} ${coefficient === 1 ? 'row' : 'rows'} of ${variable}`,
        x, y: row, width, depth: coefficient,
        orientations: ['horizontal'],
      })
      row += coefficient
    })
  })

  const stagingHeadingRow = row
  row += config.regionGapRows
  const staging: StagingRegion = {
    kind: 'staging',
    id: STAGING_REGION_ID,
    label: 'Staging (not counted)',
    x, y: row, width, depth: STAGING_ROWS,
    orientations: ['horizontal', 'vertical', 'tower'],
  }
  row += STAGING_ROWS

  return {
    columns: x + width,
    rows: row,
    variableRegions,
    staging,
    regions: [...variableRegions, staging],
    headings,
    stagingHeadingRow,
  }
}
