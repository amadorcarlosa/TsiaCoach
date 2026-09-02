using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.ScaffoldSessions;

public enum ScaffoldSessionDenialReason
{
    NoScaffoldAuthored
}

/// <summary>
/// A grant pins the attempt, the check that produced the route (null before
/// any check), and the authored entry step. Help is available before and
/// after a check; the only denial is an item with no scaffold.
/// </summary>
public sealed record ScaffoldSessionGrant(
    AttemptId AttemptId,
    CheckResultId? AuthorizedByCheckResultId,
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
        if (!coachingPolicy.HasScaffold)
        {
            return new ScaffoldSessionDenied(
                ScaffoldSessionDenialReason.NoScaffoldAuthored);
        }

        CoachingPhase phase = attempt.Phase(practiceItem);

        return phase.Value switch
        {
            BeforeCheck => FloorGrant(attempt, practiceItem, coachingPolicy),
            AfterCorrectCheck => FloorGrant(attempt, practiceItem, coachingPolicy),
            AfterIncorrectCheck => RoutedGrant(attempt, practiceItem, coachingPolicy),
            _ => throw new InvalidOperationException(
                $"Unsupported attempt phase '{phase.Value.GetType().Name}'.")
        };
    }

    private static ScaffoldSessionAuthorization FloorGrant(
        Attempt attempt,
        PracticeItem practiceItem,
        CoachingPolicy coachingPolicy)
    {
        ScaffoldEntry floor = coachingPolicy.FloorEntry()
            ?? throw new InvalidOperationException("A scaffold policy must expose a floor entry.");

        return new ScaffoldSessionGrant(
            AttemptId: attempt.Id,
            AuthorizedByCheckResultId: attempt.Checks.Count == 0 ? null : attempt.Checks[^1].Id,
            PracticeItemId: practiceItem.Id,
            ScaffoldId: floor.ScaffoldId,
            EntryStepId: floor.EntryStepId);
    }

    private static ScaffoldSessionAuthorization RoutedGrant(
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
