import { expect, test } from './mergetest/scaffold-test'

const REBUILD = 'step-rebuild-from-twos-and-ones'

test('wrong evidence stays, correct evidence advances, and reload resumes', async ({ scaffoldSession, quantityJoin }) => {
  const attemptId = await scaffoldSession.startAttempt({ incorrectChecks: 2 })
  await scaffoldSession.open(attemptId)
  await scaffoldSession.expectStep('step-join-and-read-sum')

  await quantityJoin.movePartToSum('First part, n')
  await quantityJoin.check()
  await scaffoldSession.expectStep('step-join-and-read-sum')
  await quantityJoin.expectNotMatchedYet()
  expect(scaffoldSession.submissions()[0]).toEqual({
    type: 'joinQuantities',
    parts: [{ type: 'semanticQuantity', semanticEntityId: 'entity-n' }],
  })

  await quantityJoin.movePartToSum('Next part, n + 2')
  await quantityJoin.check()
  await scaffoldSession.expectStep('step-name-bar-count')
  expect(scaffoldSession.submissions()[1]).toEqual({
    type: 'joinQuantities',
    parts: [
      { type: 'semanticQuantity', semanticEntityId: 'entity-n' },
      { type: 'latentExpression', latentMathId: 'latent-second-member' },
    ],
  })

  await scaffoldSession.reload()
  await scaffoldSession.expectStep('step-name-bar-count')
})

test('help before any check opens the walkthrough at the floor step', async ({ scaffoldSession }) => {
  const attemptId = await scaffoldSession.startAttempt()
  await scaffoldSession.open(attemptId)
  await scaffoldSession.expectStep(REBUILD)
})

test('a legal drop stays, rule-breaking drops revert, and the board survives a reload', async ({ scaffoldSession, rodGrid }) => {
  const attemptId = await scaffoldSession.startAttempt()
  await scaffoldSession.open(attemptId)
  await rodGrid.waitForBoard(REBUILD)

  // A red two on the 4, from column 1: legal and accepted.
  await rodGrid.drop({ length: 2, x: 1, y: 4 })
  await rodGrid.expectPlaced({ length: 2, x: 1, y: 4 })

  // A white on the 4 breaks "as many twos as fit": shown, then taken back.
  await rodGrid.drop({ length: 1, x: 3, y: 4 })
  await rodGrid.expectReverted({ length: 1 })
  await rodGrid.expectPlacedCount(1)

  // A white at the start of the 3 sits where a two still fits: taken back too.
  await rodGrid.drop({ length: 1, x: 1, y: 3 })
  await rodGrid.expectReverted({ y: 3 })
  await rodGrid.expectPlacedCount(1)

  await scaffoldSession.reload()
  await rodGrid.waitForBoard(REBUILD)
  await rodGrid.expectPlaced({ length: 2, x: 1, y: 4 })
})

test('an item without a scaffold shows a safe error', async ({ scaffoldSession }) => {
  const attemptId = await scaffoldSession.startAttempt({ practiceItemId: 'practice-item-sample-2', incorrectChecks: 1 })
  await scaffoldSession.open(attemptId)
  await scaffoldSession.expectSafeError('not available yet')
  await expect(scaffoldSession.safeError()).not.toContainText('stopped-at-this-year')
})

test('ask the coach sends only the step id and the question, and shows the authored reply', async ({ scaffoldSession, rodGrid, coach }) => {
  await coach.mockAnswer({ message: 'A piece comes back when it breaks the rule.', stepId: REBUILD })
  const attemptId = await scaffoldSession.startAttempt()
  await scaffoldSession.open(attemptId)
  await rodGrid.waitForBoard(REBUILD)

  await coach.open()
  await coach.ask('why did my white come back?')
  await coach.expectReply('A piece comes back when it breaks the rule.')

  expect(coach.requests()).toEqual([{ event: 'stepQuestionAsked', stepId: REBUILD, question: 'why did my white come back?' }])
  // The student stays on the step: a question never routes.
  await scaffoldSession.expectStep(REBUILD)
})
