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
    /// <param name="probeRoute">
    /// The latest recorded probe route for the attempt, if any. It decides the
    /// entry before a check; after an incorrect check the misconception route
    /// is more specific and wins.
    /// </param>
    public static ScaffoldSessionAuthorization Authorize(
        Attempt attempt,
        PracticeItem practiceItem,
        CoachingPolicy coachingPolicy,
        ProbeRoute? probeRoute = null)
    {
        if (!coachingPolicy.HasScaffold)
        {
            return new ScaffoldSessionDenied(
                ScaffoldSessionDenialReason.NoScaffoldAuthored);
        }

        if (probeRoute is not null && probeRoute.AttemptId != attempt.Id)
        {
            throw new InvalidOperationException(
                $"Probe route for attempt '{probeRoute.AttemptId.Value}' cannot authorize " +
                $"attempt '{attempt.Id.Value}'.");
        }

        CoachingPhase phase = attempt.Phase(practiceItem);

        return phase.Value switch
        {
            BeforeCheck => probeRoute is null
                ? FloorGrant(attempt, practiceItem, coachingPolicy)
                : ProbedGrant(attempt, practiceItem, coachingPolicy, probeRoute),
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

    private static ScaffoldSessionAuthorization ProbedGrant(
        Attempt attempt,
        PracticeItem practiceItem,
        CoachingPolicy coachingPolicy,
        ProbeRoute probeRoute)
    {
        // Re-derive from the authored shape so a stored step id can never
        // outrank the policy.
        ScaffoldEntry entry = coachingPolicy.EntryForShape(probeRoute.ShapeId);

        return new ScaffoldSessionGrant(
            AttemptId: attempt.Id,
            AuthorizedByCheckResultId: null,
            PracticeItemId: practiceItem.Id,
            ScaffoldId: entry.ScaffoldId,
            EntryStepId: entry.EntryStepId);
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
