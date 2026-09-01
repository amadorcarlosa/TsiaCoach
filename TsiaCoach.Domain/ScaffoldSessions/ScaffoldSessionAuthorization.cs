using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.ScaffoldSessions;

public enum ScaffoldSessionDenialReason
{
    BeforeCheck,
    InitialHint,
    AfterCorrect,
    NoScaffoldAuthored
}

public sealed record ScaffoldSessionGrant(
    AttemptId AttemptId,
    CheckResultId AuthorizedByCheckResultId,
    PracticeItemId PracticeItemId,
    ScaffoldId ScaffoldId,
    ScaffoldStepId EntryStepId);

public sealed record ScaffoldSessionDenied(
    ScaffoldSessionDenialReason Reason);

public union ScaffoldSessionAuthorization(
    ScaffoldSessionGrant,
    ScaffoldSessionDenied);

public static class ScaffoldSessionAuthorizer
{
    public static ScaffoldSessionAuthorization Authorize(
        Attempt attempt,
        PracticeItem practiceItem,
        CoachingPolicy coachingPolicy)
    {
        CoachingPhase phase = attempt.Phase(practiceItem);

        return phase.Value switch
        {
            BeforeCheck => new ScaffoldSessionDenied(
                ScaffoldSessionDenialReason.BeforeCheck),
            AfterCorrectCheck => new ScaffoldSessionDenied(
                ScaffoldSessionDenialReason.AfterCorrect),
            AfterIncorrectCheck => AuthorizeAfterIncorrect(
                attempt,
                practiceItem,
                coachingPolicy),
            _ => throw new InvalidOperationException(
                $"Unsupported attempt phase '{phase.Value.GetType().Name}'.")
        };
    }

    private static ScaffoldSessionAuthorization AuthorizeAfterIncorrect(
        Attempt attempt,
        PracticeItem practiceItem,
        CoachingPolicy coachingPolicy)
    {
        CoachingDiagnosisProjection diagnosis = coachingPolicy.ProjectDiagnosis(
            attempt,
            practiceItem);

        return diagnosis.Route.Value switch
        {
            NoScaffoldAuthored => new ScaffoldSessionDenied(
                ScaffoldSessionDenialReason.NoScaffoldAuthored),
            ScaffoldEntry entry when diagnosis.HintLevel == CoachingHintLevel.Initial =>
                new ScaffoldSessionDenied(ScaffoldSessionDenialReason.InitialHint),
            ScaffoldEntry entry => new ScaffoldSessionGrant(
                AttemptId: attempt.Id,
                AuthorizedByCheckResultId: attempt.Checks[^1].Id,
                PracticeItemId: practiceItem.Id,
                ScaffoldId: entry.ScaffoldId,
                EntryStepId: entry.EntryStepId),
            _ => throw new InvalidOperationException(
                $"Unsupported coaching route '{diagnosis.Route.Value.GetType().Name}'.")
        };
    }
}
