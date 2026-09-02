using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Attempts;

public static class AttemptProjectionMapper
{
    public static AttemptProjectionResponse ToResponse(
        Attempt attempt,
        PracticeItem item,
        CoachingPolicy policy)
    {
        AttemptPhaseResponse phase = attempt.Phase(item).Value switch
        {
            BeforeCheck => new BeforeCheckResponse(),
            AfterIncorrectCheck => ToIncorrectResponse(attempt, item, policy),
            AfterCorrectCheck correct => new AfterCorrectCheckResponse(
                correct.SelectedAnswerId.Value),
            _ => throw new InvalidOperationException("Unsupported attempt phase.")
        };

        CoachingButtonResponse button = phase switch
        {
            // Help before a check is the authored probe; without one there is
            // nothing to ask, so the control is hidden rather than improvised.
            BeforeCheckResponse => policy.Probe is null
                ? new HiddenCoachingButtonResponse()
                : new VisibleCoachingButtonResponse("Help"),
            AfterIncorrectCheckResponse => new VisibleCoachingButtonResponse("Diagnosis"),
            AfterCorrectCheckResponse => new VisibleCoachingButtonResponse("Why it works"),
            _ => throw new InvalidOperationException("Unsupported attempt projection phase.")
        };

        return new(
            AttemptId: attempt.Id.Value,
            PracticeItemId: attempt.PracticeItemId.Value,
            CheckCount: attempt.Checks.Count,
            Phase: phase,
            CoachingButton: button);
    }

    private static AfterIncorrectCheckResponse ToIncorrectResponse(
        Attempt attempt,
        PracticeItem item,
        CoachingPolicy policy)
    {
        CoachingDiagnosisProjection diagnosis = policy.ProjectDiagnosis(attempt, item);
        return new(
            SelectedAnswerId: diagnosis.SelectedAnswerId.Value,
            MisconceptionCode: diagnosis.Misconception.Value,
            Purpose: diagnosis.Purpose is null ? null : ContractName(diagnosis.Purpose.Value),
            Route: ToResponse(diagnosis.Route),
            RouteStreak: diagnosis.RouteStreak,
            HintLevel: ContractName(diagnosis.HintLevel));
    }

    private static CoachingRouteResponse ToResponse(CoachingRoute route) =>
        route.Value switch
        {
            ScaffoldEntry entry => new ScaffoldEntryRouteResponse(
                entry.ScaffoldId.Value,
                entry.EntryStepId.Value),
            NoScaffoldAuthored => new NoScaffoldAuthoredRouteResponse(),
            _ => throw new InvalidOperationException("Unsupported coaching route.")
        };

    private static string ContractName<TEnum>(TEnum value)
        where TEnum : struct, Enum
    {
        string name = value.ToString();
        return name.Length == 0
            ? name
            : char.ToLowerInvariant(name[0]) + name[1..];
    }
}
