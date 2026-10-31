import { describe, it, expect } from 'vitest'
import { validateScene, layeredRoleOf } from './rod-scene.placement'
import type {
  MaterialRole,
  Rectangle,
  RodTrain,
  ScenePolicy,
  SceneRegion,
} from './rod.scene.types'

const regions = [
  { id: 'horizontal-d', x: 2, y: 0, width: 24, depth: 1, orientations: ['horizontal'] },
  { id: 'vertical-d', x: 0, y: 2, width: 1, depth: 12, orientations: ['vertical'] },
  { id: 'array', x: 2, y: 2, width: 24, depth: 12, orientations: ['horizontal', 'vertical'] },
] as const satisfies readonly SceneRegion[]

/** The 4 × 6 whole the acceptance example defines. */
const whole: Rectangle = { x: 2, y: 2, width: 4, depth: 6 }

function policy(options: {
  layered?: boolean
  whole?: Rectangle | null
} = {}): ScenePolicy {
  const base: ScenePolicy = {
    columns: 26,
    rows: 14,
    spawnRows: [2],
    regions,
    editable: () => true,
    allowOrientation: true,
  }

  if (options.layered === undefined) return base

  return {
    ...base,
    layeredRoles: {
      enabled: () => options.layered!,
      regionId: 'array',
      wholeOf: () => options.whole === undefined ? whole : options.whole,
    },
  }
}

function train(
  id: string,
  x: number,
  y: number,
  value: number,
  materialRole?: MaterialRole,
): RodTrain {
  return {
    id,
    anchor: { x, y },
    parts: [{ value: value as RodTrain['parts'][number]['value'], offset: { x: 0, y: 0 }, orientation: 'horizontal' }],
    ...(materialRole ? { materialRole } : {}),
  }
}

/** Both D references, so the whole is defined in the scene itself. */
const references: RodTrain[] = [
  { id: 'h-d', anchor: { x: 2, y: 0 }, parts: [{ value: 4, offset: { x: 0, y: 0 }, orientation: 'horizontal' }] },
  { id: 'v-d', anchor: { x: 0, y: 2 }, parts: [{ value: 6, offset: { x: 0, y: 0 }, orientation: 'vertical' }] },
]

describe('layered material roles', () => {
  describe('cross-role overlap', () => {
    const stacked = [
      ...references,
      train('tile', 2, 2, 4, 'denominator'),
      train('rod', 2, 2, 4, 'numerator'),
    ]

    it('lets a numerator rod sit on a denominator tile in fraction multiplication', () => {
      expect(validateScene(stacked, policy({ layered: true })))
        .toEqual({ allowed: true })
    })

    it('rejects the same pair in every other mode, role metadata and all', () => {
      // The ordinary area activity: same scene, same roles, no layered policy.
      expect(validateScene(stacked, policy()))
        .toEqual({ allowed: false, reason: 'That arrangement overlaps another part.' })

      // Configured but inactive: the mode predicate is what authorises it.
      expect(validateScene(stacked, policy({ layered: false })))
        .toEqual({ allowed: false, reason: 'That arrangement overlaps another part.' })
    })

    it('rejects two numerator rods on the same cells', () => {
      const result = validateScene([
        ...references,
        train('a', 2, 2, 4, 'numerator'),
        train('b', 2, 2, 4, 'numerator'),
      ], policy({ layered: true }))

      expect(result).toEqual({
        allowed: false,
        reason: 'Two numerator pieces cannot share the same cells.',
      })
    })

    it('rejects two denominator tiles on the same cells', () => {
      const result = validateScene([
        ...references,
        train('a', 2, 2, 4, 'denominator'),
        train('b', 2, 2, 4, 'denominator'),
      ], policy({ layered: true }))

      expect(result).toEqual({
        allowed: false,
        reason: 'Two denominator pieces cannot share the same cells.',
      })
    })

    it('rejects parts of one train overlapping each other whatever its role', () => {
      const malformed: RodTrain = {
        id: 'self',
        anchor: { x: 2, y: 2 },
        materialRole: 'numerator',
        parts: [
          { value: 4, offset: { x: 0, y: 0 }, orientation: 'horizontal' },
          { value: 4, offset: { x: 0, y: 0 }, orientation: 'horizontal' },
        ],
      }

      expect(validateScene([...references, malformed], policy({ layered: true })))
        .toEqual({ allowed: false, reason: 'That arrangement overlaps another part.' })
    })

    it('treats central material saved before roles existed as numerator', () => {
      // Legacy central material keeps its historical selected-quantity meaning,
      // so it layers over tiles but still collides with other numerators.
      const legacy = train('legacy', 2, 2, 4)

      expect(validateScene(
        [...references, train('tile', 2, 2, 4, 'denominator'), legacy],
        policy({ layered: true }),
      )).toEqual({ allowed: true })

      expect(validateScene(
        [...references, train('rod', 2, 2, 4, 'numerator'), legacy],
        policy({ layered: true }),
      )).toEqual({
        allowed: false,
        reason: 'Two numerator pieces cannot share the same cells.',
      })
    })

    it('never layers reference-track pieces, which carry no role', () => {
      const onTrack: RodTrain = {
        id: 'second-d', anchor: { x: 2, y: 0 }, materialRole: 'numerator',
        parts: [{ value: 4, offset: { x: 0, y: 0 }, orientation: 'horizontal' }],
      }

      expect(validateScene([...references, onTrack], policy({ layered: true })))
        .toEqual({ allowed: false, reason: 'That arrangement overlaps another part.' })
    })

    it('lets one numerator rod span several denominator tile boundaries', () => {
      const result = validateScene([
        { id: 'h-d', anchor: { x: 2, y: 0 }, parts: [{ value: 2, offset: { x: 0, y: 0 }, orientation: 'horizontal' }] },
        { id: 'v-d', anchor: { x: 0, y: 2 }, parts: [{ value: 6, offset: { x: 0, y: 0 }, orientation: 'vertical' }] },
        train('tile-a', 2, 2, 2, 'denominator'),
        train('tile-b', 2, 3, 2, 'denominator'),
        // A vertical 2 crossing both tiles: tile edges do not constrain it.
        {
          id: 'rod', anchor: { x: 2, y: 2 }, materialRole: 'numerator',
          parts: [{ value: 2, offset: { x: 0, y: 0 }, orientation: 'vertical' }],
        },
      ], policy({ layered: true, whole: { x: 2, y: 2, width: 2, depth: 6 } }))

      expect(result).toEqual({ allowed: true })
    })
  })

  describe('whole containment', () => {
    it('accepts a numerator rod placed on the bare whole with no tiles', () => {
      expect(validateScene(
        [...references, train('rod', 2, 2, 4, 'numerator')],
        policy({ layered: true }),
      )).toEqual({ allowed: true })
    })

    it('rejects a numerator rod reaching outside the whole', () => {
      const result = validateScene(
        [...references, train('rod', 3, 2, 4, 'numerator')],
        policy({ layered: true }),
      )

      expect(result.allowed).toBe(false)
      expect(result.allowed === false && result.reason)
        .toContain('Numerator rods must stay inside the 4 × 6 whole')
    })

    it('explains that the whole must exist before numerator rods do', () => {
      const result = validateScene(
        [train('rod', 2, 2, 4, 'numerator')],
        policy({ layered: true, whole: null }),
      )

      expect(result).toEqual({
        allowed: false,
        reason: 'Define the whole with both D references before placing numerator rods.',
      })
    })

    it('leaves denominator tiles free to sit outside the whole', () => {
      expect(validateScene(
        [...references, train('tile', 10, 9, 4, 'denominator')],
        policy({ layered: true }),
      )).toEqual({ allowed: true })
    })

    it('does not constrain anything when the activity is inactive', () => {
      expect(validateScene(
        [...references, train('rod', 3, 2, 4, 'numerator')],
        policy({ layered: false }),
      )).toEqual({ allowed: true })
    })
  })

  describe('layeredRoleOf', () => {
    it('reports no role unless the activity is active', () => {
      expect(layeredRoleOf(train('a', 2, 2, 4, 'denominator'), policy())).toBeNull()
      expect(layeredRoleOf(train('a', 2, 2, 4, 'denominator'), policy({ layered: false }))).toBeNull()
    })

    it('reports no role for material outside the layered region', () => {
      expect(layeredRoleOf(train('a', 2, 0, 4, 'denominator'), policy({ layered: true }))).toBeNull()
    })

    it('reports the persisted role for central material', () => {
      expect(layeredRoleOf(train('a', 2, 2, 4, 'denominator'), policy({ layered: true })))
        .toBe('denominator')
      expect(layeredRoleOf(train('a', 2, 2, 4), policy({ layered: true })))
        .toBe('numerator')
    })
  })

  it('leaves ordinary scenes without regions on the plain overlap rule', () => {
    const plain: ScenePolicy = {
      columns: 10, rows: 10, spawnRows: [0],
      editable: () => true, allowOrientation: true,
    }

    expect(validateScene(
      [train('a', 0, 0, 4, 'denominator'), train('b', 0, 0, 4, 'numerator')],
      plain,
    )).toEqual({ allowed: false, reason: 'That arrangement overlaps another part.' })
  })
})
