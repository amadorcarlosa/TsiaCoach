import { describe, expect, it } from 'vitest'
import type { PlaygroundEventDraft, PlaygroundRecorder } from '~/effect/playground-events'
import { useAlgebraTileScene } from '~/composables/useAlgebraTileScene'
import { useBaseTenScene } from '~/composables/useBaseTenScene'
import { useRodScene } from '~/composables/useRodScene'
import { RECENT_ACTION_LIMIT, recordPlaygroundScene } from './scene-events'

function recorder(playground: PlaygroundRecorder['playground']) {
  const drafts: PlaygroundEventDraft[] = []
  return { drafts, recorder: { playground, record: (draft: PlaygroundEventDraft) => { drafts.push(draft) } } }
}

const rodScene = () => useRodScene({ columns: 24, rows: 12, spawnRows: [4], editable: () => true, allowOrientation: true })

describe('scene action recording', () => {
  it('records algebra tile actions with their outcome and a coefficient summary', () => {
    const log = recorder('algebra-tiles')
    const scene = recordPlaygroundScene(useAlgebraTileScene({ editable: () => true, columns: 12, rows: 12 }), 'algebra-tiles', log.recorder)

    scene.apply([], { type: 'create', term: 'x', sign: 'positive' })
    const [id] = [...scene.selection.value]
    scene.apply([id!], { type: 'move', delta: { x: 0, y: 0 } })
    scene.apply([id!], { type: 'move', delta: { x: 100, y: 0 } })

    expect(log.drafts.map(draft => [draft.type, draft.outcome])).toEqual([['tile.added', 'applied'], ['tile.moved', 'rejected']])
    expect(log.drafts[0]).toMatchObject({ data: { term: 'x', sign: 'positive', createdIds: [id] }, sceneSummary: { x: 1, tiles: 1 } })
    expect(log.drafts[1]).toMatchObject({ reason: 'Keep tiles inside the board without overlapping.', data: { pieceIds: [id], pieceKinds: ['x'] } })
  })

  it('counts the tiles a zero-pair removal took away', () => {
    const log = recorder('algebra-tiles')
    const scene = recordPlaygroundScene(useAlgebraTileScene({ editable: () => true, columns: 12, rows: 12 }), 'algebra-tiles', log.recorder)
    scene.apply([], { type: 'create', term: 'one', sign: 'positive' })
    scene.apply([], { type: 'create', term: 'one', sign: 'negative' })

    scene.apply(scene.tiles.value.map(tile => tile.id), { type: 'remove-zero-pairs' })

    expect(log.drafts.at(-1)).toMatchObject({ type: 'zero-pair.cancelled', outcome: 'applied', data: { count: 2, pieceKinds: ['one', 'one.neg'] } })
  })

  it('records base ten exchanges and totals', () => {
    const log = recorder('base-ten')
    const scene = recordPlaygroundScene(useBaseTenScene({ editable: () => true, columns: 40, rows: 40 }), 'base-ten', log.recorder)
    scene.apply([], { type: 'create', denomination: 'tens' })

    scene.apply([...scene.selection.value], { type: 'exchange-down' })

    expect(log.drafts.at(-1)).toMatchObject({
      type: 'exchange.regrouped',
      outcome: 'applied',
      data: { variant: 'down', pieceKinds: ['tens'] },
      sceneSummary: { ones: 10, blocks: 10, total: 10 },
    })
  })

  it('records rod actions, including created IDs and rod counts', () => {
    const log = recorder('bar-rod')
    const scene = recordPlaygroundScene(rodScene(), 'bar-rod', log.recorder)

    const created = scene.apply([], { type: 'create', value: 3 })
    scene.apply([], { type: 'delete' })

    expect(created.allowed).toBe(true)
    expect(log.drafts[0]).toMatchObject({ type: 'piece.created', outcome: 'applied', data: { value: 3 }, sceneSummary: { 'rod-3': 1, trains: 1, total: 3 } })
    expect(log.drafts[0]!.data.createdIds).toEqual(created.allowed ? [...created.createdIds] : [])
    expect(log.drafts[1]).toMatchObject({ type: 'piece.deleted', outcome: 'rejected' })
  })

  it('folds several edits into one event', () => {
    const log = recorder('rod-count-systems')
    const scene = recordPlaygroundScene(rodScene(), 'rod-count-systems', log.recorder)

    scene.events.during(() => [scene.apply([], { type: 'create', value: 3 }), scene.apply([], { type: 'create', value: 3 })], results => ({
      type: 'count.rod-added', outcome: 'applied', data: { variant: 'x', count: results.length },
    }))

    expect(log.drafts).toEqual([{ type: 'count.rod-added', outcome: 'applied', data: { variant: 'x', count: 2 }, sceneSummary: { 'rod-3': 2, trains: 2, total: 6 } }])
  })

  it('adds playground state to every summary, its keys first and within the key limit', () => {
    const log = recorder('rod-count-systems')
    const scene = recordPlaygroundScene(rodScene(), 'rod-count-systems', log.recorder)
    scene.events.addSummary(() => ({ xCount: 7, trains: -1 }))

    scene.apply([], { type: 'create', value: 3 })
    scene.events.record({ type: 'hint.requested', outcome: 'applied', data: { value: 1 } })

    expect(log.drafts[0]!.sceneSummary).toEqual({ xCount: 7, trains: -1, 'rod-3': 1, total: 3 })
    expect(log.drafts[1]!.sceneSummary).toMatchObject({ xCount: 7, 'rod-3': 1 })

    const crowded = recordPlaygroundScene(rodScene(), 'bar-rod', log.recorder)
    crowded.events.addSummary(() => Object.fromEntries(Array.from({ length: 39 }, (_, index) => [`k${index}`, index])))
    crowded.apply([], { type: 'create', value: 3 })
    expect(Object.keys(log.drafts.at(-1)!.sceneSummary!)).toHaveLength(40)
  })

  it('leaves the scene silent when the log is off, and never lets a recorder break it', () => {
    const silent = recordPlaygroundScene(rodScene(), 'bar-rod', null)
    expect(silent.apply([], { type: 'create', value: 2 }).allowed).toBe(true)

    const broken = recordPlaygroundScene(rodScene(), 'bar-rod', {
      playground: 'bar-rod',
      record: () => { throw new Error('offline') },
    })
    expect(broken.apply([], { type: 'create', value: 2 }).allowed).toBe(true)
    expect(broken.trains.value).toHaveLength(1)
  })

  it('keeps recent actions for board captures even when the log is off', () => {
    const scene = recordPlaygroundScene(rodScene(), 'bar-rod', null)
    for (let index = 0; index < RECENT_ACTION_LIMIT + 2; index++) scene.apply([], { type: 'create', value: 1 })

    const recent = scene.events.recent()
    expect(recent).toHaveLength(RECENT_ACTION_LIMIT)
    expect(recent.at(-1)).toMatchObject({ type: 'piece.created', outcome: 'applied', sceneSummary: { 'rod-1': RECENT_ACTION_LIMIT + 2 } })
    expect(typeof recent[0]!.at).toBe('string')
    // Callers get copies; the history cannot be edited from outside.
    ;(recent[0]!.data as { value?: number }).value = 99
    expect(scene.events.recent()[0]!.data.value).toBe(1)
  })
})
