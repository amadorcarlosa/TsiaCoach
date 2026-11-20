// @vitest-environment happy-dom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref, shallowRef } from 'vue'
import type { ScenePolicy } from '~/components/rod/scene/rod.scene.types'
import { recordPlaygroundScene } from '~/components/playground/events/scene-events'
import { countLayout, unitTrain } from '~/components/systems/systems.count-layout'
import { systemsFixtures } from '~/components/systems/systems.fixtures'
import { planSystemsTransform } from '~/components/systems/systems.operations'
import type { SystemsBoardConfig } from '~/components/systems/systems.schema'
import type { PlaygroundEventDraft } from '~/effect/playground-events'
import { useBoardTransformPreview } from './useBoardTransformPreview'
import { useRodScene } from './useRodScene'
import { useSystemsCountActivity } from './useSystemsCountActivity'

const reference = systemsFixtures.rodCountReference.config as SystemsBoardConfig

enableAutoUnmount(afterEach)

/** A logged rod-count board holding the given whole x and y rods, set up inside a component. */
function setup(xCount: number, yCount: number) {
  let built!: ReturnType<typeof build>
  mount(defineComponent({ setup: () => { built = build(xCount, yCount); return () => h('div') } }))
  return built
}

function build(xCount: number, yCount: number) {
  const layout = countLayout(reference)
  const { x: a, y: b } = reference.system.equations[0].coefficients
  const policy: ScenePolicy = {
    columns: layout.columns,
    rows: layout.rows,
    spawnRows: [layout.upper.y],
    regions: layout.regions,
    editable: () => true,
    allowOrientation: true,
    allowFactors: true,
    regionBoundEdits: true,
    planTransform: (trains, ids, transform) => {
      const result = planSystemsTransform(reference, trains, ids, transform)
      return result.allowed ? { allowed: true, remove: result.plan.remove, add: result.plan.add } : result
    },
  }
  const drafts: PlaygroundEventDraft[] = []
  const scene = recordPlaygroundScene(useRodScene(policy), 'rod-count-systems', {
    playground: 'rod-count-systems',
    record: draft => { drafts.push(draft) },
  })
  expect(scene.replace([
    ...Array.from({ length: xCount }, (_, index) => unitTrain(layout.upper.x + index, 0, a, `x${index}`)),
    ...Array.from({ length: yCount }, (_, index) => unitTrain(layout.upper.x + xCount + index, 0, b, `y${index}`)),
  ]).allowed).toBe(true)
  const preview = useBoardTransformPreview({
    scene,
    viewport: ref(null),
    disabled: () => false,
    beforeOpen: () => {},
    plan: (ids, transform) => planSystemsTransform(reference, scene.trains.value, ids, transform),
    staleReason: 'stale',
  })
  const count = useSystemsCountActivity({
    config: shallowRef(reference),
    scene,
    preview,
    blocked: () => false,
    editable: () => true,
    events: scene.events,
  })
  return { scene, count, drafts }
}

describe('rod-count activity log', () => {
  it('records hints and exchange selection with the equations the learner saw', () => {
    const { count, drafts } = setup(21, 1)

    count.nextHint()
    expect(count.selectForExchange()).toBe(true)

    expect(drafts.map(draft => [draft.type, draft.outcome])).toEqual([
      ['hint.requested', 'applied'],
      ['exchange.selected', 'applied'],
    ])
    expect(drafts[0]!.data).toEqual({ value: 1 })
    expect(drafts[1]!.data.count).toBe(8)
    expect(drafts[1]!.data.pieceIds).toHaveLength(8)
    expect(drafts[1]!.sceneSummary).toMatchObject({
      xCount: 21,
      yCount: 1,
      unassigned: 0,
      eq1Holds: 1,
      eq2Holds: 0,
      eq2Stale: 0,
      converting: 0,
      solved: 0,
      hintLevel: 1,
    })
    expect(drafts[1]!.sceneSummary!.eq2Total).toBe(count.display.value.check!.total)
  })

  it('tells a learner cancel from a board cancel', () => {
    const { count, drafts } = setup(21, 1)
    count.selectForExchange()
    count.beginConversion()
    count.cancelConversion()
    count.beginConversion()
    count.cancelConversion('Editing is not available right now.')

    const cancels = drafts.filter(draft => draft.type === 'conversion.cancelled')
    expect(cancels.map(draft => draft.data.variant)).toEqual(['learner', 'system'])
    expect(drafts.find(draft => draft.type === 'conversion.started')!.sceneSummary).toMatchObject({ xCount: 21 })
  })

  it('counts lying x and y rods after a rotation', () => {
    const { scene, drafts } = setup(1, 0)
    const rotated = scene.apply(['x0'], { type: 'set-orientation', orientation: 'horizontal' })
    expect(rotated.allowed ? '' : rotated.reason).toBe('')
    expect(drafts.at(-1)).toMatchObject({
      type: 'rotated',
      data: { orientation: 'horizontal', pieceIds: ['x0'] },
      sceneSummary: { xCount: 1, xLying: 1, yLying: 0 },
    })
  })

  it('records a refused exchange selection', () => {
    const { count, drafts } = setup(0, 0)
    expect(count.selectForExchange()).toBe(false)
    expect(drafts.at(-1)).toMatchObject({ type: 'exchange.selected', outcome: 'rejected' })
  })
})
