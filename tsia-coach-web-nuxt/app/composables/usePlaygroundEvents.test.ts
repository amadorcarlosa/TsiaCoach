import { describe, expect, it } from 'vitest'
import type { StartPlaygroundSession } from '#shared/effect/playground-events'
import type { PlaygroundEventDraft } from '~/effect/playground-events'
import { gateRecorders } from './usePlaygroundEvents'

function fakeLog() {
  const sessions: StartPlaygroundSession[] = []
  const drafts: PlaygroundEventDraft[] = []
  return {
    sessions,
    drafts,
    log: {
      recorder(input: StartPlaygroundSession) {
        sessions.push(input)
        return { playground: input.playground, record: (draft: PlaygroundEventDraft) => { drafts.push(draft) } }
      },
      flush: async () => {},
    },
  }
}

const draft: PlaygroundEventDraft = { type: 'tile.added', outcome: 'applied', data: {} }

describe('consent gate', () => {
  it('records nothing and opens no session until consent, then marks the session as consented', () => {
    const fake = fakeLog()
    let granted = false
    const sink = gateRecorders(fake.log, { required: true, allowed: () => granted })
    const recorder = sink.recorder({ playground: 'algebra-tiles', attemptId: 'attempt-1' })

    recorder.record(draft)
    expect(fake.sessions).toEqual([])
    granted = true
    recorder.record(draft)
    recorder.record(draft)
    granted = false
    recorder.record(draft)

    expect(fake.sessions).toEqual([{ playground: 'algebra-tiles', attemptId: 'attempt-1', consent: 'granted' }])
    expect(fake.drafts).toHaveLength(2)
  })

  it('omits the consent flag where the deployment does not ask', () => {
    const fake = fakeLog()
    gateRecorders(fake.log, { required: false, allowed: () => true }).recorder({ playground: 'base-ten' }).record(draft)
    expect(fake.sessions).toEqual([{ playground: 'base-ten' }])
  })
})
