using System.Collections.Generic;
using System.Linq;

using TsiaCoach.Domain.Mathematics;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.WebApi.Tests;

public sealed class PracticeItemEvaluationTests
{
    [Test]
    public async Task PracticeItemOne_AnswerA_ReturnsIncorrectCheckOrdinaryStepAndMissingSum()
    {
        CheckOutcome outcome = PracticeItemOne.Item.Evaluate(new("answer-a"));

        IncorrectCheck? incorrect = outcome.Value as IncorrectCheck;
        await Assert.That(incorrect is not null).IsTrue();
        await Assert.That(incorrect!.Misconception).IsEqualTo(new MisconceptionCode("ordinary-step-and-missing-sum"));
    }

    [Test]
    public async Task PracticeItemOne_AnswerB_ReturnsIncorrectCheckStoppedAtSecondInteger()
    {
        CheckOutcome outcome = PracticeItemOne.Item.Evaluate(new("answer-b"));

        IncorrectCheck? incorrect = outcome.Value as IncorrectCheck;
        await Assert.That(incorrect is not null).IsTrue();
        await Assert.That(incorrect!.Misconception).IsEqualTo(new MisconceptionCode("stopped-at-second-integer"));
    }

    [Test]
    public async Task PracticeItemOne_AnswerC_ReturnsIncorrectCheckOrdinaryStepInSum()
    {
        CheckOutcome outcome = PracticeItemOne.Item.Evaluate(new("answer-c"));

        IncorrectCheck? incorrect = outcome.Value as IncorrectCheck;
        await Assert.That(incorrect is not null).IsTrue();
        await Assert.That(incorrect!.Misconception).IsEqualTo(new MisconceptionCode("ordinary-step-in-sum"));
    }

    [Test]
    public async Task PracticeItemOne_AnswerD_ReturnsCorrectCheck()
    {
        CheckOutcome outcome = PracticeItemOne.Item.Evaluate(new("answer-d"));

        CorrectCheck? correct = outcome.Value as CorrectCheck;
        await Assert.That(correct is not null).IsTrue();
    }

    [Test]
    public async Task PracticeItemTwo_AnswerA_ReturnsIncorrectCheckIncompleteThisYear()
    {
        CheckOutcome outcome = PracticeItemTwo.Item.Evaluate(new("answer-a"));

        IncorrectCheck? incorrect = outcome.Value as IncorrectCheck;
        await Assert.That(incorrect is not null).IsTrue();
        await Assert.That(incorrect!.Misconception).IsEqualTo(new MisconceptionCode("incomplete-this-year"));
    }

    [Test]
    public async Task PracticeItemTwo_AnswerB_ReturnsIncorrectCheckStoppedAtThisYear()
    {
        CheckOutcome outcome = PracticeItemTwo.Item.Evaluate(new("answer-b"));

        IncorrectCheck? incorrect = outcome.Value as IncorrectCheck;
        await Assert.That(incorrect is not null).IsTrue();
        await Assert.That(incorrect!.Misconception).IsEqualTo(new MisconceptionCode("stopped-at-this-year"));
    }

    [Test]
    public async Task PracticeItemTwo_AnswerC_ReturnsIncorrectCheckScaledVariableOnly()
    {
        CheckOutcome outcome = PracticeItemTwo.Item.Evaluate(new("answer-c"));

        IncorrectCheck? incorrect = outcome.Value as IncorrectCheck;
        await Assert.That(incorrect is not null).IsTrue();
        await Assert.That(incorrect!.Misconception).IsEqualTo(new MisconceptionCode("scaled-variable-only"));
    }

    [Test]
    public async Task PracticeItemTwo_AnswerD_ReturnsCorrectCheck()
    {
        CheckOutcome outcome = PracticeItemTwo.Item.Evaluate(new("answer-d"));

        CorrectCheck? correct = outcome.Value as CorrectCheck;
        await Assert.That(correct is not null).IsTrue();
    }

    [Test]
    public async Task Create_RejectsEmptyAnswerCollection()
    {
        await AssertInvalid(
            "must contain at least one answer",
            () => CreatePracticeItem(
                answers: Array.Empty<AnswerChoice>()));
    }

    [Test]
    public async Task Create_RejectsDuplicateAnswerId()
    {
        await AssertInvalid(
            "Duplicate answer id",
            () => CreatePracticeItem(
                answers: PracticeItemOne.Item.Answers
                    .Append(PracticeItemOne.Item.Answers[0])
                    .ToArray()));
    }

    [Test]
    public async Task Create_RejectsUnknownCorrectAnswerId()
    {
        await AssertInvalid(
            "has unknown correct answer id",
            () => CreatePracticeItem(correctAnswerId: new AnswerChoiceId("answer-unknown")));
    }

    [Test]
    public async Task Create_RejectsMissingDistractorEntry()
    {
        await AssertInvalid(
            "has no distractor entry for answer",
            () => CreatePracticeItem(
                distractors: PracticeItemOne.Item.Distractors
                    .Where(pair => pair.Key != new AnswerChoiceId("answer-a"))
                    .ToDictionary(pair => pair.Key, pair => pair.Value)));
    }

    [Test]
    public async Task Create_RejectsExtraForeignDistractorEntry()
    {
        Dictionary<AnswerChoiceId, MisconceptionCode> distractors =
            new(PracticeItemOne.Item.Distractors)
            {
                [new AnswerChoiceId("answer-foreign")] = new("unknown-misconception")
            };

        await AssertInvalid(
            "distractor entry for unknown answer",
            () => CreatePracticeItem(distractors: distractors));
    }

    [Test]
    public async Task Create_RejectsCorrectAnswerIncludedInDistractors()
    {
        Dictionary<AnswerChoiceId, MisconceptionCode> distractors =
            new(PracticeItemOne.Item.Distractors)
            {
                [new AnswerChoiceId("answer-d")] = new("should-not-be-used")
            };

        await AssertInvalid(
            "cannot include the correct answer",
            () => CreatePracticeItem(distractors: distractors));
    }

    [Test]
    public async Task Create_RejectsEmptyMisconceptionCode()
    {
        await AssertInvalid(
            "cannot be empty",
            () => CreatePracticeItem(
                distractors: new Dictionary<AnswerChoiceId, MisconceptionCode>(PracticeItemOne.Item.Distractors)
                {
                    [new AnswerChoiceId("answer-a")] = new(string.Empty)
                }));
    }

    [Test]
    public async Task Create_RejectsWhitespaceMisconceptionCode()
    {
        await AssertInvalid(
            "cannot be empty",
            () => CreatePracticeItem(
                distractors: new Dictionary<AnswerChoiceId, MisconceptionCode>(PracticeItemOne.Item.Distractors)
                {
                    [new AnswerChoiceId("answer-a")] = new(" ")
                }));
    }

    [Test]
    public async Task Create_RejectsMissingAnswerMathBinding()
    {
        await AssertInvalid(
            "is missing an answer-math binding",
            () => CreatePracticeItem(
                answerMathBindings: PracticeItemOne.Item.AnswerMathBindings
                    .Where((_, index) => index > 0)
                    .ToArray()));
    }

    [Test]
    public async Task Create_RejectsDuplicateAnswerMathBinding()
    {
        await AssertInvalid(
            "duplicate answer-math binding",
            () => CreatePracticeItem(
                answerMathBindings: PracticeItemOne.Item.AnswerMathBindings
                    .Concat(new[] { PracticeItemOne.Item.AnswerMathBindings[0] })
                    .ToArray()));
    }

    [Test]
    public async Task Create_RejectsForeignAnswerMathBinding()
    {
        await AssertInvalid(
            "answer-math binding for unknown answer",
            () => CreatePracticeItem(
                answerMathBindings: PracticeItemOne.Item.AnswerMathBindings
                    .Append(new AnswerMathBinding(
                        AnswerChoiceId: new("answer-foreign"),
                        MathObjectId: PracticeItemOne.Item.AnswerMathBindings[0].MathObjectId))
                    .ToArray()));
    }

    [Test]
    public async Task Create_RejectsAnswerMathBindingToUnknownMathObject()
    {
        await AssertInvalid(
            "binds answer",
            () => CreatePracticeItem(
                answerMathBindings: PracticeItemOne.Item.AnswerMathBindings
                    .Select(binding =>
                        binding.AnswerChoiceId == new AnswerChoiceId("answer-a")
                            ? new AnswerMathBinding(
                                AnswerChoiceId: binding.AnswerChoiceId,
                                MathObjectId: new MathObjectId("math-ghost"))
                            : binding)
                    .ToArray()));
    }

    [Test]
    public async Task Evaluate_RejectsUnknownAnswerChoice()
    {
        InvalidOperationException? exception = null;

        try
        {
            _ = PracticeItemOne.Item.Evaluate(new("answer-foreign"));
        }
        catch (InvalidOperationException ex)
        {
            exception = ex;
        }

        await Assert.That(exception is not null).IsTrue();
        await Assert.That(exception!.Message).Contains("does not belong to practice item");
    }

    private static PracticeItem CreatePracticeItem(
        IReadOnlyList<AnswerChoice>? answers = null,
        IReadOnlyList<AnswerMathBinding>? answerMathBindings = null,
        IReadOnlyDictionary<AnswerChoiceId, MisconceptionCode>? distractors = null,
        AnswerChoiceId? correctAnswerId = null)
    {
        PracticeItem source = PracticeItemOne.Item;

        return PracticeItem.Create(
            id: source.Id,
            text: source.Text,
            semantics: source.Semantics,
            mathematics: source.Mathematics,
            answers: answers ?? source.Answers,
            answerMathBindings: answerMathBindings ?? source.AnswerMathBindings,
            correctAnswerId: correctAnswerId ?? source.CorrectAnswerId,
            distractors: distractors ?? source.Distractors);
    }

    private static async Task AssertInvalid(
        string expectedMessage,
        Func<PracticeItem> createItem)
    {
        InvalidOperationException? exception = null;

        try
        {
            _ = createItem();
        }
        catch (InvalidOperationException ex)
        {
            exception = ex;
        }

        await Assert.That(exception is not null).IsTrue();
        await Assert.That(exception!.Message).Contains(expectedMessage);
    }
}
