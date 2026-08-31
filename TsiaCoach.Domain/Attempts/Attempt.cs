using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;

using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Attempts;

public sealed class Attempt
{
    public AttemptId Id { get; }

    public PracticeItemId PracticeItemId { get; }

    public IReadOnlyList<CheckResult> Checks { get; }

    private Attempt(
        AttemptId id,
        PracticeItemId practiceItemId,
        IReadOnlyList<CheckResult> checks)
    {
        Id = id;
        PracticeItemId = practiceItemId;
        Checks = new ReadOnlyCollection<CheckResult>(checks.ToList());
    }

    public static Attempt Start(
        AttemptId id,
        PracticeItem practiceItem) =>
        new Attempt(id, practiceItem.Id, Array.Empty<CheckResult>());

    public CoachingPhase Phase(PracticeItem practiceItem)
    {
        if (practiceItem.Id != PracticeItemId)
        {
            throw new InvalidOperationException(
                $"Attempt '{Id.Value}' cannot evaluate against practice item '{practiceItem.Id.Value}' " +
                $"because the attempt is pinned to practice item '{PracticeItemId.Value}'.");
        }

        if (Checks.Count == 0)
        {
            return new CoachingPhase(new BeforeCheck());
        }

        CheckResult lastCheck = Checks[^1];
        CheckOutcome outcome = practiceItem.Evaluate(lastCheck.SelectedAnswerId);

        return outcome.Value switch
        {
            CorrectCheck => new CoachingPhase(new AfterCorrectCheck(lastCheck.SelectedAnswerId)),
            IncorrectCheck incorrect => new CoachingPhase(
                new AfterIncorrectCheck(lastCheck.SelectedAnswerId, incorrect.Misconception)),
            _ => throw new InvalidOperationException(
                $"Unsupported check outcome '{outcome.Value.GetType().Name}' in attempt '{Id.Value}'.")
        };
    }

    public Attempt Append(
        CheckResultId checkResultId,
        AnswerChoiceId selectedAnswerId,
        DateTimeOffset checkedAt,
        PracticeItem practiceItem)
    {
        if (practiceItem.Id != PracticeItemId)
        {
            throw new InvalidOperationException(
                $"Attempt '{Id.Value}' cannot append for practice item '{practiceItem.Id.Value}' " +
                $"because the attempt is pinned to practice item '{PracticeItemId.Value}'.");
        }

        CoachingPhase phase = Phase(practiceItem);
        if (phase.Value is AfterCorrectCheck)
        {
            throw new InvalidOperationException(
                $"Attempt '{Id.Value}' is terminal after a correct check and cannot accept additional checks.");
        }

        _ = practiceItem.Evaluate(selectedAnswerId);

        if (Checks.Any(check => check.Id == checkResultId))
        {
            throw new InvalidOperationException(
                $"Attempt '{Id.Value}' already has check '{checkResultId.Value}'.");
        }

        if (Checks.Count > 0 && checkedAt < Checks[^1].CheckedAt)
        {
            throw new InvalidOperationException(
                $"Attempt '{Id.Value}' append uses out-of-order checkedAt '{checkedAt:O}' " +
                $"before prior check '{Checks[^1].CheckedAt:O}'.");
        }

        List<CheckResult> appended = new(Checks.Count + 1);
        appended.AddRange(Checks);
        appended.Add(new CheckResult(checkResultId, selectedAnswerId, checkedAt));
        return new Attempt(Id, PracticeItemId, appended);
    }
}
