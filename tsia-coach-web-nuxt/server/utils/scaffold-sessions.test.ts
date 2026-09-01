import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseScaffoldSubmission } from './scaffold-sessions'

describe('scaffold session learner-evidence boundary', () => {
  it('accepts learner evidence without a correctness claim', () => {
    expect(parseScaffoldSubmission({
      type: 'enterScalar',
      value: 2,
    })).toEqual({ type: 'enterScalar', value: 2 })
  })

  it.each(['satisfied', 'successCheck', 'expectedValue', 'correctAnswerId'])(
    'rejects client field %s',
    field => {
      expect(() => parseScaffoldSubmission({
        type: 'enterScalar',
        value: 2,
        [field]: true,
      })).toThrow()
    },
  )

  it('requires a learner-submission discriminator', () => {
    expect(() => parseScaffoldSubmission({ value: 2 })).toThrow()
  })

  it('keeps solution-bearing names out of the active student runner', () => {
    const root = fileURLToPath(new URL('../../', import.meta.url))
    const activeFiles = [
      'app/pages/scaffolds/[id].vue',
      'app/pages/scaffolds/scaffold-session.ts',
      'app/components/scaffold/ParityLadderScene.vue',
      'app/components/scaffold/QuestionContext.vue',
    ]
    const source = activeFiles
      .map(path => readFileSync(`${root}${path}`, 'utf8'))
      .join('\n')

    expect(source).not.toMatch(/expectedScalar|expectedExpression|correctAnswerId|successCheck/)
  })
})
