using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;

using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.ValueObjects;

using static TsiaCoach.Domain.PracticeItems.PracticeItem;

namespace TsiaCoach.WebApi.Tests;

public sealed class AttemptDomainTests
{
    [Test]
    public async Task Start_CreatesEmptyAttemptForPracticeItem()
    {
        Attempt attempt = Attempt.Start(new("attempt-empty"), PracticeItemOne.Item);

        await Assert.That(attempt.Id).IsEqualTo(new AttemptId("attempt-empty"));
        await Assert.That(attempt.PracticeItemId).IsEqualTo(PracticeItemOne.Id);
        await Assert.That(attempt.Checks.Count).IsEqualTo(0);
    }

    [Test]
    public async Task Attempt_CreationIsDomainControlled()
    {
        var publicConstructors = typeof(Attempt)
            .GetConstructors(BindingFlags.Public | BindingFlags.Instance);

        await Assert.That(publicConstructors.Length).IsEqualTo(0);
    }

    [Test]
    public async Task EmptyAttempt_DerivesBeforeCheck()
    {
        Attempt attempt = Attempt.Start(new("attempt-before"), PracticeItemOne.Item);
        CoachingPhase phase = attempt.Phase(PracticeItemOne.Item);

        BeforeCheck? before = phase.Value as BeforeCheck;
        await Assert.That(before is not null).IsTrue();
    }

    [Test]
    public async Task AppendIncorrect_ReturnsNewAttemptAndLeavesOriginalUnchanged()
    {
        Attempt attempt = Attempt.Start(new("attempt-append-incorrect"), PracticeItemOne.Item);
        Attempt second = attempt.Append(new("check-1"), new("answer-b"), new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero), PracticeItemOne.Item);

        await Assert.That(attempt.Checks.Count).IsEqualTo(0);
        await Assert.That(second.Checks.Count).IsEqualTo(1);
        await Assert.That(second.Checks[0].SelectedAnswerId).IsEqualTo(new AnswerChoiceId("answer-b"));
    }

    [Test]
    public async Task IncorrectAttempt_DerivesAfterIncorrectCheck()
    {
        Attempt attempt = Attempt.Start(new("attempt-one-incorrect"), PracticeItemOne.Item)
            .Append(new("check-1"), new("answer-b"), new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero), PracticeItemOne.Item);

        CoachingPhase phase = attempt.Phase(PracticeItemOne.Item);
        AfterIncorrectCheck? incorrect = phase.Value as AfterIncorrectCheck;

        await Assert.That(incorrect is not null).IsTrue();
        await Assert.That(incorrect!.SelectedAnswerId).IsEqualTo(new AnswerChoiceId("answer-b"));
        await Assert.That(incorrect.Misconception).IsEqualTo(new("stopped-at-second-integer"));
    }

    [Test]
    public async Task AppendCorrect_DerivesAfterCorrectCheck()
    {
        Attempt attempt = Attempt.Start(new("attempt-one-correct"), PracticeItemOne.Item)
            .Append(new("check-1"), new("answer-d"), new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero), PracticeItemOne.Item);

        CoachingPhase phase = attempt.Phase(PracticeItemOne.Item);
        AfterCorrectCheck? correct = phase.Value as AfterCorrectCheck;

        await Assert.That(correct is not null).IsTrue();
        await Assert.That(correct!.SelectedAnswerId).IsEqualTo(new AnswerChoiceId("answer-d"));
    }

    [Test]
    public async Task CorrectOnFirstCheck_IsTerminal()
    {
        Attempt attempt = Attempt.Start(new("attempt-terminal"), PracticeItemOne.Item)
            .Append(new("check-1"), new("answer-d"), new(2026, 1, 1, 0, 0, 1, TimeSpan.Zero), PracticeItemOne.Item);

        CoachingPhase phase = attempt.Phase(PracticeItemOne.Item);

        await Assert.That(phase.Value is AfterCorrectCheck).IsTrue();
    }

    [Test]
    public async Task WrongThenCorrect_DerivesAfterCorrectCheck()
    {
        Attempt attempt = Attempt.Start(new("attempt-wrong-then-correct"), PracticeItemOne.Item)
            .Append(new("check-1"), new("answer-b"), new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero), PracticeItemOne.Item)
            .Append(new("check-2"), new("answer-d"), new(2026, 1, 1, 0, 0, 1, TimeSpan.Zero), PracticeItemOne.Item);

        CoachingPhase phase = attempt.Phase(PracticeItemOne.Item);
        AfterCorrectCheck? correct = phase.Value as AfterCorrectCheck;

        await Assert.That(correct is not null).IsTrue();
        await Assert.That(attempt.Checks.Count).IsEqualTo(2);
        await Assert.That(correct!.SelectedAnswerId).IsEqualTo(new AnswerChoiceId("answer-d"));
    }

    [Test]
    public async Task MultipleIncorrectChecks_PreserveInsertionOrder()
    {
        Attempt attempt = Attempt.Start(new("attempt-multiple-incorrect"), PracticeItemOne.Item)
            .Append(new("check-a"), new("answer-a"), new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero), PracticeItemOne.Item)
            .Append(new("check-b"), new("answer-b"), new(2026, 1, 1, 0, 0, 1, TimeSpan.Zero), PracticeItemOne.Item);

        await Assert.That(attempt.Checks.Count).IsEqualTo(2);
        await Assert.That(attempt.Checks[0].Id).IsEqualTo(new CheckResultId("check-a"));
        await Assert.That(attempt.Checks[1].Id).IsEqualTo(new CheckResultId("check-b"));
        await Assert.That(attempt.Checks.Select(check => check.SelectedAnswerId))
            .IsEquivalentTo([new AnswerChoiceId("answer-a"), new AnswerChoiceId("answer-b")]);
    }

    [Test]
    public async Task Phase_UsesLatestIncorrectCheck()
    {
        Attempt attempt = Attempt.Start(new("attempt-latest-incorrect"), PracticeItemOne.Item)
            .Append(new("check-a"), new("answer-a"), new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero), PracticeItemOne.Item)
            .Append(new("check-b"), new("answer-c"), new(2026, 1, 1, 0, 0, 1, TimeSpan.Zero), PracticeItemOne.Item);

        CoachingPhase phase = attempt.Phase(PracticeItemOne.Item);
        AfterIncorrectCheck? incorrect = phase.Value as AfterIncorrectCheck;

        await Assert.That(incorrect is not null).IsTrue();
        await Assert.That(incorrect!.SelectedAnswerId).IsEqualTo(new AnswerChoiceId("answer-c"));
        await Assert.That(incorrect.Misconception).IsEqualTo(new MisconceptionCode("ordinary-step-in-sum"));
    }

    [Test]
    public async Task AppendAfterCorrect_IsRejected()
    {
        Attempt attempt = Attempt.Start(new("attempt-append-after-correct"), PracticeItemOne.Item)
            .Append(new("check-1"), new("answer-d"), new(2026, 1, 1, 0, 0, 1, TimeSpan.Zero), PracticeItemOne.Item);

        await AssertInvalidOperation(
            "terminal",
            () => _ = attempt.Append(
                new("check-2"),
                new("answer-b"),
                new(2026, 1, 1, 0, 0, 2, TimeSpan.Zero),
                PracticeItemOne.Item));
    }

    [Test]
    public async Task AppendWithForeignPracticeItem_IsRejected()
    {
        Attempt attempt = Attempt.Start(new("attempt-append-foreign-item"), PracticeItemOne.Item);

        await AssertInvalidOperation(
            "pinned to practice item",
            () => _ = attempt.Append(new("check-1"), new("answer-d"), new(2026, 1, 1, 0, 0, 1, TimeSpan.Zero), PracticeItemTwo.Item));
    }

    [Test]
    public async Task PhaseWithForeignPracticeItem_IsRejected()
    {
        Attempt attempt = Attempt.Start(new("attempt-phase-foreign-item"), PracticeItemOne.Item);

        await AssertInvalidOperation(
            "cannot evaluate against practice item",
            () => _ = attempt.Phase(PracticeItemTwo.Item));
    }

    [Test]
    public async Task AppendWithForeignAnswerChoice_IsRejected()
    {
        Attempt attempt = Attempt.Start(new("attempt-foreign-answer"), PracticeItemOne.Item);

        await AssertInvalidOperation(
            "does not belong to practice item",
            () => _ = attempt.Append(
                new("check-1"),
                new("answer-foreign"),
                new(2026, 1, 1, 0, 0, 1, TimeSpan.Zero),
                PracticeItemOne.Item));
    }

    [Test]
    public async Task AppendWithDuplicateCheckResultId_IsRejected()
    {
        Attempt attempt = Attempt.Start(new("attempt-duplicate-check"), PracticeItemOne.Item)
            .Append(new("check-1"), new("answer-b"), new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero), PracticeItemOne.Item);

        await AssertInvalidOperation(
            "already has check",
            () => _ = attempt.Append(
                new("check-1"),
                new("answer-c"),
                new(2026, 1, 1, 0, 0, 1, TimeSpan.Zero),
                PracticeItemOne.Item));
    }

    [Test]
    public async Task AppendWithEarlierTimestamp_IsRejected()
    {
        Attempt attempt = Attempt.Start(new("attempt-older-timestamp"), PracticeItemOne.Item)
            .Append(new("check-1"), new("answer-b"), new(2026, 1, 1, 0, 0, 1, TimeSpan.Zero), PracticeItemOne.Item);

        await AssertInvalidOperation(
            "out-of-order checkedAt",
            () => _ = attempt.Append(
                new("check-2"),
                new("answer-c"),
                new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero),
                PracticeItemOne.Item));
    }

    [Test]
    public async Task EqualTimestamp_IsAllowed()
    {
        DateTimeOffset checkedAt = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

        Attempt attempt = Attempt.Start(new("attempt-equal-timestamp"), PracticeItemOne.Item)
            .Append(new("check-1"), new("answer-b"), checkedAt, PracticeItemOne.Item)
            .Append(new("check-2"), new("answer-a"), checkedAt, PracticeItemOne.Item);

        await Assert.That(attempt.Checks.Count).IsEqualTo(2);
        await Assert.That(attempt.Checks[0].CheckedAt).IsEqualTo(checkedAt);
        await Assert.That(attempt.Checks[1].CheckedAt).IsEqualTo(checkedAt);
    }

    [Test]
    public async Task CheckResult_ContainsSubmissionFactsOnly()
    {
        var propertyNames = typeof(CheckResult)
            .GetProperties(BindingFlags.Instance | BindingFlags.Public)
            .Select(property => property.Name)
            .ToArray();

        await Assert.That(propertyNames.Length).IsEqualTo(3);
        await Assert.That(propertyNames.Contains("Id")).IsTrue();
        await Assert.That(propertyNames.Contains("SelectedAnswerId")).IsTrue();
        await Assert.That(propertyNames.Contains("CheckedAt")).IsTrue();
        await Assert.That(propertyNames.Contains("IsCorrect")).IsFalse();
        await Assert.That(propertyNames.Contains("CheckOutcome")).IsFalse();
    }

    [Test]
    public async Task AppendDoesNotStoreDerivedOutcome()
    {
        Attempt attempt = Attempt.Start(new("attempt-no-derived"), PracticeItemOne.Item)
            .Append(new("check-1"), new("answer-b"), new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero), PracticeItemOne.Item);

        var propertyNames = attempt.Checks.Single()
            .GetType()
            .GetProperties(BindingFlags.Instance | BindingFlags.Public)
            .Select(property => property.Name)
            .ToArray();

        await Assert.That(propertyNames.Contains("CorrectCheck")).IsFalse();
        await Assert.That(propertyNames.Contains("MisconceptionCode")).IsFalse();
        await Assert.That(propertyNames.Contains("CoachingPhase")).IsFalse();
        await Assert.That(propertyNames.Contains("ScaffoldStepId")).IsFalse();
        await Assert.That(propertyNames.Contains("Route")).IsFalse();
    }

    [Test]
    public async Task Attempt_CheckHistoryCannotBeReplacedOrMutated()
    {
        Attempt attempt = Attempt.Start(new("attempt-immutable-history"), PracticeItemOne.Item)
            .Append(new("check-1"), new("answer-b"), new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero), PracticeItemOne.Item);

        await Assert.That(attempt.Checks is CheckResult[]).IsFalse();

        var mutable = (attempt.Checks as IList<CheckResult>);
        await Assert.That(mutable is not null).IsTrue();

        Exception? notSupported = null;
        try
        {
            mutable!.Add(new CheckResult(new("check-2"), new("answer-a"), new(2026, 1, 1, 0, 0, 1, TimeSpan.Zero)));
        }
        catch (NotSupportedException ex)
        {
            notSupported = ex;
        }

        await Assert.That(notSupported is not null).IsTrue();
    }

    [Test]
    public async Task Attempt_CheckHistoryCannotBeChangedThroughAppendResult()
    {
        Attempt first = Attempt.Start(new("attempt-history"), PracticeItemOne.Item)
            .Append(new("check-1"), new("answer-b"), new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero), PracticeItemOne.Item);

        _ = first.Append(new("check-2"), new("answer-a"), new(2026, 1, 1, 0, 0, 1, TimeSpan.Zero), PracticeItemOne.Item);
        Attempt second = first.Append(new("check-3"), new("answer-c"), new(2026, 1, 1, 0, 0, 2, TimeSpan.Zero), PracticeItemOne.Item);

        await Assert.That(first.Checks.Count).IsEqualTo(1);
        await Assert.That(first.Checks[0].Id).IsEqualTo(new CheckResultId("check-1"));
        await Assert.That(second.Checks.Count).IsEqualTo(2);
    }

    [Test]
    public async Task PracticeItemTwoIncorrect_DerivesUpdatedReferenceDiagnosis()
    {
        Attempt attempt = Attempt.Start(new("attempt-item-two-incorrect"), PracticeItemTwo.Item)
            .Append(new("check-1"), new("answer-a"), new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero), PracticeItemTwo.Item);

        CoachingPhase phase = attempt.Phase(PracticeItemTwo.Item);
        AfterIncorrectCheck? incorrect = phase.Value as AfterIncorrectCheck;

        await Assert.That(incorrect is not null).IsTrue();
        await Assert.That(incorrect!.Misconception).IsEqualTo(new MisconceptionCode("this-year-resolved-as-w"));
        await Assert.That(incorrect.SelectedAnswerId).IsEqualTo(new AnswerChoiceId("answer-a"));
    }

    private static async Task AssertInvalidOperation(string expectedMessageFragment, Action action)
    {
        InvalidOperationException? exception = null;

        try
        {
            action();
        }
        catch (InvalidOperationException ex)
        {
            exception = ex;
        }

        await Assert.That(exception is not null).IsTrue();
        await Assert.That(exception!.Message).Contains(expectedMessageFragment);
    }
}
