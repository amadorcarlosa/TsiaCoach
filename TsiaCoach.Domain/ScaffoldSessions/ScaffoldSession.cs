using System.Collections.ObjectModel;

using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.Scaffolds.Evaluation;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.ScaffoldSessions;

public readonly record struct ScaffoldSessionId(string Value);
public readonly record struct ScaffoldCheckResultId(string Value);

public sealed record ScaffoldCheckResult(
    ScaffoldCheckResultId Id,
    ScaffoldStepId StepId,
    ScaffoldStepSubmission Submission,
    DateTimeOffset CheckedAt);

public sealed record ActiveScaffoldSession(
    ScaffoldStepId CurrentStepId,
    int CompletedStepCount,
    int TotalStepCount);

public sealed record CompletedScaffoldSession(
    int TotalStepCount);

public union ScaffoldSessionProgress(
    ActiveScaffoldSession,
    CompletedScaffoldSession);

public sealed class ScaffoldSession
{
    public ScaffoldSessionId Id { get; }
    public AttemptId AttemptId { get; }
    public CheckResultId? AuthorizedByCheckResultId { get; }
    public PracticeItemId PracticeItemId { get; }
    public ScaffoldId ScaffoldId { get; }
    public ScaffoldStepId EntryStepId { get; }
    public IReadOnlyList<ScaffoldCheckResult> Checks { get; }

    private ScaffoldSession(
        ScaffoldSessionId id,
        ScaffoldSessionGrant grant,
        IReadOnlyList<ScaffoldCheckResult> checks)
    {
        Id = id;
        AttemptId = grant.AttemptId;
        AuthorizedByCheckResultId = grant.AuthorizedByCheckResultId;
        PracticeItemId = grant.PracticeItemId;
        ScaffoldId = grant.ScaffoldId;
        EntryStepId = grant.EntryStepId;
        Checks = new ReadOnlyCollection<ScaffoldCheckResult>(checks.ToList());
    }

    public static ScaffoldSession Start(
        ScaffoldSessionId id,
        ScaffoldSessionGrant grant,
        Scaffold scaffold)
    {
        ArgumentNullException.ThrowIfNull(grant);
        ArgumentNullException.ThrowIfNull(scaffold);

        ValidateGrant(grant, scaffold);
        _ = AuthorizedSteps(grant.EntryStepId, scaffold);
        return new ScaffoldSession(id, grant, Array.Empty<ScaffoldCheckResult>());
    }

    public ScaffoldSessionProgress Progress(
        PracticeItem practiceItem,
        Scaffold scaffold)
    {
        EnsureTargetsMatch(practiceItem, scaffold);
        ScaffoldStep[] authorizedSteps = AuthorizedSteps(EntryStepId, scaffold);
        int currentStepIndex = 0;

        foreach (ScaffoldCheckResult check in Checks)
        {
            if (currentStepIndex >= authorizedSteps.Length)
            {
                throw new InvalidOperationException(
                    $"Scaffold session '{Id.Value}' contains a check after completion.");
            }

            ScaffoldStep currentStep = authorizedSteps[currentStepIndex];
            if (check.StepId != currentStep.Id)
            {
                throw new InvalidOperationException(
                    $"Scaffold session '{Id.Value}' check '{check.Id.Value}' targets step " +
                    $"'{check.StepId.Value}' instead of current step '{currentStep.Id.Value}'.");
            }

            ScaffoldStepEvaluation evaluation = ScaffoldStepEvaluator.Evaluate(
                scaffold,
                practiceItem,
                currentStep.Id,
                check.Submission);

            if (evaluation.Value is ScaffoldStepSatisfied)
            {
                currentStepIndex++;
            }
        }

        return currentStepIndex == authorizedSteps.Length
            ? new CompletedScaffoldSession(authorizedSteps.Length)
            : new ActiveScaffoldSession(
                CurrentStepId: authorizedSteps[currentStepIndex].Id,
                CompletedStepCount: currentStepIndex,
                TotalStepCount: authorizedSteps.Length);
    }

    public ScaffoldSession Append(
        ScaffoldCheckResultId checkResultId,
        ScaffoldStepSubmission submission,
        DateTimeOffset checkedAt,
        PracticeItem practiceItem,
        Scaffold scaffold)
    {
        EnsureTargetsMatch(practiceItem, scaffold);

        if (Checks.Any(check => check.Id == checkResultId))
        {
            throw new InvalidOperationException(
                $"Scaffold session '{Id.Value}' already has check '{checkResultId.Value}'.");
        }

        if (Checks.Count > 0 && checkedAt < Checks[^1].CheckedAt)
        {
            throw new InvalidOperationException(
                $"Scaffold session '{Id.Value}' append uses out-of-order checkedAt " +
                $"'{checkedAt:O}' before prior check '{Checks[^1].CheckedAt:O}'.");
        }

        ScaffoldSessionProgress progress = Progress(practiceItem, scaffold);
        if (progress.Value is CompletedScaffoldSession)
        {
            throw new InvalidOperationException(
                $"Scaffold session '{Id.Value}' is complete and cannot accept additional checks.");
        }

        ActiveScaffoldSession active = (ActiveScaffoldSession)progress.Value;
        _ = ScaffoldStepEvaluator.Evaluate(
            scaffold,
            practiceItem,
            active.CurrentStepId,
            submission);

        List<ScaffoldCheckResult> appended = new(Checks.Count + 1);
        appended.AddRange(Checks);
        appended.Add(new ScaffoldCheckResult(
            Id: checkResultId,
            StepId: active.CurrentStepId,
            Submission: submission,
            CheckedAt: checkedAt));

        return new ScaffoldSession(
            id: Id,
            grant: new ScaffoldSessionGrant(
                AttemptId,
                AuthorizedByCheckResultId,
                PracticeItemId,
                ScaffoldId,
                EntryStepId),
            checks: appended);
    }

    private static void ValidateGrant(
        ScaffoldSessionGrant grant,
        Scaffold scaffold)
    {
        if (grant.PracticeItemId != scaffold.PracticeItemId)
        {
            throw new InvalidOperationException(
                $"Scaffold session grant targets practice item '{grant.PracticeItemId.Value}', " +
                $"but scaffold '{scaffold.Id.Value}' targets '{scaffold.PracticeItemId.Value}'.");
        }

        if (grant.ScaffoldId != scaffold.Id)
        {
            throw new InvalidOperationException(
                $"Scaffold session grant targets scaffold '{grant.ScaffoldId.Value}', " +
                $"but the supplied scaffold is '{scaffold.Id.Value}'.");
        }
    }

    private void EnsureTargetsMatch(
        PracticeItem practiceItem,
        Scaffold scaffold)
    {
        if (practiceItem.Id != PracticeItemId)
        {
            throw new InvalidOperationException(
                $"Scaffold session '{Id.Value}' is pinned to practice item '{PracticeItemId.Value}', " +
                $"not '{practiceItem.Id.Value}'.");
        }

        if (scaffold.PracticeItemId != PracticeItemId)
        {
            throw new InvalidOperationException(
                $"Scaffold session '{Id.Value}' is pinned to practice item '{PracticeItemId.Value}', " +
                $"but scaffold '{scaffold.Id.Value}' targets '{scaffold.PracticeItemId.Value}'.");
        }

        if (scaffold.Id != ScaffoldId)
        {
            throw new InvalidOperationException(
                $"Scaffold session '{Id.Value}' is pinned to scaffold '{ScaffoldId.Value}', " +
                $"not '{scaffold.Id.Value}'.");
        }
    }

    /// <summary>
    /// The latest accepted submission for the current step, or null when the
    /// step has none yet. This is the learner's own evidence, safe to return
    /// so a reload can resume a half-built board.
    /// </summary>
    public ScaffoldStepSubmission? CurrentStepEvidence(
        PracticeItem practiceItem,
        Scaffold scaffold)
    {
        EnsureTargetsMatch(practiceItem, scaffold);
        ScaffoldStep[] authorizedSteps = AuthorizedSteps(EntryStepId, scaffold);
        int currentStepIndex = 0;
        ScaffoldStepSubmission? evidence = null;

        foreach (ScaffoldCheckResult check in Checks)
        {
            if (currentStepIndex >= authorizedSteps.Length)
            {
                break;
            }

            ScaffoldStepEvaluation evaluation = ScaffoldStepEvaluator.Evaluate(
                scaffold,
                practiceItem,
                authorizedSteps[currentStepIndex].Id,
                check.Submission);

            switch (evaluation.Value)
            {
                case ScaffoldStepSatisfied:
                    currentStepIndex++;
                    evidence = null;
                    break;
                case ScaffoldStepAccepted:
                    evidence = check.Submission;
                    break;
            }
        }

        return evidence;
    }

    private static ScaffoldStep[] AuthorizedSteps(
        ScaffoldStepId entryStepId,
        Scaffold scaffold)
    {
        if (!scaffold.ContainsStep(entryStepId))
        {
            throw new InvalidOperationException(
                $"Scaffold entry step '{entryStepId.Value}' does not exist in scaffold '{scaffold.Id.Value}'.");
        }

        return scaffold.PathFrom(entryStepId).ToArray();
    }
}
