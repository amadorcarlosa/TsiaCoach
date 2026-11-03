import type { Point } from '~/components/grid/gridPointer'
import type { AreaGrouping, AreaGroupReading } from '~/components/tabla/area-grouping'
import type { DeepReadonly } from 'vue'
import type { CuisenaireRodValue } from '../rod.types'

/** A rod's arithmetic sign. It never changes geometry, colour or collision. */
export type RodSign = 1 | -1

export type TrainPart = {
  /** Physical magnitude: length, colour and footprint. Never negative. */
  value: CuisenaireRodValue
  /** Absent means positive, so scenes and files written before signs still mean what they did. */
  sign?: RodSign
  /** Membership in the two addends of a regrouped train. */
  addendGroup?: 0 | 1
  offset: Point
  orientation: 'horizontal' | 'vertical' | 'tower'
}

/**
 * What a piece of central material stands for. 'denominator' is the whole or
 * its partition; 'numerator' is the quantity selected from it. This is scene
 * data, not styling: collision, readouts and persistence all read it.
 */
export type MaterialRole = 'denominator' | 'numerator'

export const materialRoles = ['denominator', 'numerator'] as const satisfies readonly MaterialRole[]

export type RodTrain = {
  id: string
  anchor: Point
  parts: TrainPart[]
  /**
   * Absent on reference-track pieces and on every ordinary scene. A role alone
   * never authorises overlap: the layered policy must be active as well.
   */
  materialRole?: MaterialRole
}

export type SceneRegion = {
  id: string
  x: number
  y: number
  width: number
  depth: number
  orientations: readonly TrainPart['orientation'][]
}

export type AddendPair = readonly [number, number]

/**
 * A board-specific command, such as a systems "repeat row". The board's pure
 * planner turns it into removals and additions at check and at commit, so the
 * scene never trusts trains supplied by a preview.
 */
export type BoardTransform = {
  name: string
  params?: Readonly<Record<string, number>>
  /** The planner's input key when the preview opened; a mismatch is stale. */
  expected?: string
}

export type BoardTransformPlan =
  | { allowed: true; remove: readonly string[]; add: readonly RodTrain[] }
  | { allowed: false; reason: string }

export type AddendChoice = {
  pair: AddendPair
  result: SceneResult
}

export type FactorShape = {
  rows: number
  columns: number
}

export type FactorChoice = {
  shape: FactorShape
  result: SceneResult
}

export type AreaGroupingChoice = {
  reading: AreaGroupReading
  result: SceneResult
  /** The selected rectangle already shows this grouping. */
  active: boolean
}

export type SceneAction =
    | {
      type: 'create'
      value: CuisenaireRodValue
      row?: number
      regionId?: string
      /** Creation intent. Never inferred from the destination afterwards. */
      materialRole?: MaterialRole
      /** Creation intent from the tray. Absent means positive. */
      sign?: RodSign
    }
    // Deliberate role conversion. Moving a piece must never do this silently.
    | { type: 'set-material-role'; materialRole: MaterialRole }
    | { type: 'move'; delta: Point }
    | { type: 'clone' }
    | { type: 'delete' }
    | { type: 'make-train' }
    | { type: 'regroup-ones' }
    | { type: 'regroup-addends'; pair?: AddendPair }
    | { type: 'regroup-factors'; shape?: FactorShape }
    // Repartitions a filled rectangle in place. Unlike regroup-factors it
    // cannot change the footprint, only how the same cells are grouped.
    | { type: 'regroup-area'; grouping: AreaGrouping }
    | { type: 'ungroup' }
    | { type: 'board-transform'; transform: BoardTransform }
    | {
      type: 'cancel-zero-pair'
      /**
       * The two trains exactly as the preview saw them. A stale-view guard,
       * not a result: the scene recomputes the plan from its own data.
       */
      expectedInputs: readonly DeepReadonly<RodTrain>[]
    }
    | {
  type: 'set-orientation'
  orientation: TrainPart['orientation']
}

export type Rectangle = {
  x: number
  y: number
  width: number
  depth: number
}

/**
 * Fraction-multiplication layering. A board supplies this only while that
 * activity is active, and every caller reads `enabled()` rather than inferring
 * the mode from roles, colours, reference values or board identity.
 */
export type LayeredRolesPolicy = {
  enabled: () => boolean
  /** Only material contained in this region layers; references never do. */
  regionId: string
  /**
   * The whole, derived from the *candidate* scene's D references, so moving a
   * reference is validated against the numerator rods already placed. Null
   * when the whole is not defined yet.
   */
  wholeOf: (trains: readonly RodTrain[]) => Rectangle | null
}

export type ScenePolicy = {
  columns: number
  rows: number
  spawnRows: readonly number[]
  trackRows?: readonly number[]
  regions?: readonly SceneRegion[]
  editable: () => boolean
  allowOrientation: boolean
  allowFactors?: boolean
  /** Opt in to regroup-area; Bar and Fraction scenes have no area to group. */
  allowAreaRegroup?: boolean
  /** Every part must be horizontal and share the train's anchor row. */
  requireHorizontalAnchorRow?: boolean
  /** Absent in every ordinary scene, which keeps the plain no-overlap rule. */
  layeredRoles?: LayeredRolesPolicy
  /**
   * Opt in to negative rods. Checked when creating and when replacing or
   * importing a scene; boards without it accept positive material only.
   */
  allowNegativeRods?: boolean
  /** Opt in to cancelling one positive and one negative rod as a zero pair. */
  allowZeroPairCancellation?: boolean
  /**
   * Joins, clones and factor arrangements stay in their source region.
   * Factors search nearest free positions there. Boards whose regions carry
   * meaning opt in; others retain their existing placement behavior.
   */
  regionBoundEdits?: boolean
  /** Planner for 'board-transform' actions. Absent boards reject them. */
  planTransform?: (
    trains: readonly RodTrain[],
    ids: readonly string[],
    transform: BoardTransform,
  ) => BoardTransformPlan
}

export type SceneResult =
    | { allowed: true }
    | { allowed: false; reason: string }

export type SceneApplyResult =
    | { allowed: true; createdIds: readonly string[] }
    | { allowed: false; reason: string }
