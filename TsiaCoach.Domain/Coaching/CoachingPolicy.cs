using System.Collections.ObjectModel;

using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Coaching;

public sealed class CoachingPolicy
{
    private readonly IReadOnlyDictionary<ScaffoldPhasePurpose, CoachingRoute> routeByPurpose;

    public PracticeItemId PracticeItemId { get; }

    public IReadOnlyDictionary<MisconceptionCode, ScaffoldPhasePurpose> PurposeByCode { get; }

    private CoachingPolicy(
        PracticeItemId practiceItemId,
        IReadOnlyDictionary<MisconceptionCode, ScaffoldPhasePurpose> purposeByCode,
        IReadOnlyDictionary<ScaffoldPhasePurpose, CoachingRoute> routeByPurpose)
    {
        PracticeItemId = practiceItemId;
        PurposeByCode = new ReadOnlyDictionary<MisconceptionCode, ScaffoldPhasePurpose>(
            new Dictionary<MisconceptionCode, ScaffoldPhasePurpose>(purposeByCode));
        this.routeByPurpose = new ReadOnlyDictionary<ScaffoldPhasePurpose, CoachingRoute>(
            new Dictionary<ScaffoldPhasePurpose, CoachingRoute>(routeByPurpose));
    }

    public static CoachingPolicy CreateWithScaffold(
        PracticeItem practiceItem,
        IReadOnlyDictionary<MisconceptionCode, ScaffoldPhasePurpose> purposeByCode,
        Scaffold scaffold)
    {
        if (scaffold is null)
        {
            throw new InvalidOperationException(
                "CreateWithScaffold requires an authored scaffold; use CreateWithoutScaffold when none exists.");
        }

        CoachingPolicyValidator.Validate(practiceItem, purposeByCode, scaffold);
        return CreateValidated(practiceItem, purposeByCode, scaffold);
    }

    public static CoachingPolicy CreateWithoutScaffold(
        PracticeItem practiceItem,
        IReadOnlyDictionary<MisconceptionCode, ScaffoldPhasePurpose> purposeByCode)
    {
        CoachingPolicyValidator.Validate(practiceItem, purposeByCode, scaffold: null);
        return CreateValidated(practiceItem, purposeByCode, scaffold: null);
    }

    public ScaffoldPhasePurpose PurposeFor(MisconceptionCode misconception)
    {
        if (!PurposeByCode.TryGetValue(misconception, out ScaffoldPhasePurpose purpose))
        {
            throw new InvalidOperationException(
                $"No coaching purpose is authored for misconception '{misconception.Value}' " +
                $"on practice item '{PracticeItemId.Value}'.");
        }

        return purpose;
    }

    public CoachingRoute RouteFor(MisconceptionCode misconception) =>
        routeByPurpose[PurposeFor(misconception)];

    public CoachingDiagnosisProjection ProjectDiagnosis(
        Attempt attempt,
        PracticeItem practiceItem)
    {
        EnsureTargetsMatch(attempt, practiceItem);

        CoachingPhase phase = attempt.Phase(practiceItem);
        if (phase.Value is not AfterIncorrectCheck latestIncorrect)
        {
            throw new InvalidOperationException(
                phase.Value switch
                {
                    BeforeCheck => "A diagnosis cannot be projected before an incorrect check.",
                    AfterCorrectCheck => "A diagnosis cannot be projected after a correct check.",
                    _ => "A diagnosis can only be projected after an incorrect check."
                });
        }

        ScaffoldPhasePurpose latestPurpose = PurposeFor(latestIncorrect.Misconception);
        CoachingRoute route = routeByPurpose[latestPurpose];
        int routeStreak = CountLatestPurposeStreak(attempt, practiceItem, latestPurpose);

        return new CoachingDiagnosisProjection(
            SelectedAnswerId: latestIncorrect.SelectedAnswerId,
            Misconception: latestIncorrect.Misconception,
            Purpose: latestPurpose,
            Route: route,
            RouteStreak: routeStreak,
            HintLevel: routeStreak == 1
                ? CoachingHintLevel.Initial
                : CoachingHintLevel.Escalated);
    }

    private static CoachingPolicy CreateValidated(
        PracticeItem practiceItem,
        IReadOnlyDictionary<MisconceptionCode, ScaffoldPhasePurpose> purposeByCode,
        Scaffold? scaffold)
    {
        Dictionary<ScaffoldPhasePurpose, CoachingRoute> routeByPurpose = [];

        foreach (ScaffoldPhasePurpose purpose in purposeByCode.Values.Distinct())
        {
            routeByPurpose[purpose] = scaffold is null
                ? new CoachingRoute(new NoScaffoldAuthored())
                : new CoachingRoute(ScaffoldEntryResolver.Resolve(scaffold, purpose));
        }

        return new CoachingPolicy(practiceItem.Id, purposeByCode, routeByPurpose);
    }

    private void EnsureTargetsMatch(Attempt attempt, PracticeItem practiceItem)
    {
        if (attempt.PracticeItemId != PracticeItemId ||
            practiceItem.Id != PracticeItemId)
        {
            throw new InvalidOperationException(
                $"Coaching policy for practice item '{PracticeItemId.Value}' cannot project " +
                $"an attempt or practice item targeting a different item.");
        }
    }

    private int CountLatestPurposeStreak(
        Attempt attempt,
        PracticeItem practiceItem,
        ScaffoldPhasePurpose latestPurpose)
    {
        int streak = 0;

        for (int index = attempt.Checks.Count - 1; index >= 0; index--)
        {
            CheckOutcome outcome = practiceItem.Evaluate(attempt.Checks[index].SelectedAnswerId);
            if (outcome.Value is not IncorrectCheck incorrect)
            {
                break;
            }

            if (PurposeFor(incorrect.Misconception) != latestPurpose)
            {
                break;
            }

            streak++;
        }

        return streak;
    }
}
