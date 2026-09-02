using System.Collections.ObjectModel;

using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Coaching;

/// <summary>
/// Authored routing from a check's misconception code to a step id on the
/// item's scaffold path. The policy is an index into the path; it never
/// searches for a step by purpose.
/// </summary>
public sealed class CoachingPolicy
{
    private readonly Scaffold? scaffold;

    public PracticeItemId PracticeItemId { get; }

    public IReadOnlyDictionary<MisconceptionCode, ScaffoldStepId> EntryStepByCode { get; }

    public IReadOnlySet<MisconceptionCode> AuthoredCodes { get; }

    private CoachingPolicy(
        PracticeItemId practiceItemId,
        IReadOnlySet<MisconceptionCode> authoredCodes,
        IReadOnlyDictionary<MisconceptionCode, ScaffoldStepId> entryStepByCode,
        Scaffold? scaffold)
    {
        PracticeItemId = practiceItemId;
        AuthoredCodes = authoredCodes;
        EntryStepByCode = new ReadOnlyDictionary<MisconceptionCode, ScaffoldStepId>(
            new Dictionary<MisconceptionCode, ScaffoldStepId>(entryStepByCode));
        this.scaffold = scaffold;
    }

    public static CoachingPolicy CreateWithScaffold(
        PracticeItem practiceItem,
        IReadOnlyDictionary<MisconceptionCode, ScaffoldStepId> entryStepByCode,
        Scaffold scaffold)
    {
        if (scaffold is null)
        {
            throw new InvalidOperationException(
                "CreateWithScaffold requires an authored scaffold; use CreateWithoutScaffold when none exists.");
        }

        CoachingPolicyValidator.Validate(practiceItem, entryStepByCode, scaffold);

        return new CoachingPolicy(
            practiceItem.Id,
            entryStepByCode.Keys.ToHashSet(),
            entryStepByCode,
            scaffold);
    }

    public static CoachingPolicy CreateWithoutScaffold(PracticeItem practiceItem) =>
        new(
            practiceItem.Id,
            practiceItem.Distractors.Values.ToHashSet(),
            new Dictionary<MisconceptionCode, ScaffoldStepId>(),
            scaffold: null);

    public bool HasScaffold => scaffold is not null;

    public CoachingRoute RouteFor(MisconceptionCode misconception)
    {
        if (!AuthoredCodes.Contains(misconception))
        {
            throw new InvalidOperationException(
                $"No coaching route is authored for misconception '{misconception.Value}' " +
                $"on practice item '{PracticeItemId.Value}'.");
        }

        return scaffold is null
            ? new CoachingRoute(new NoScaffoldAuthored())
            : new CoachingRoute(new ScaffoldEntry(scaffold.Id, EntryStepByCode[misconception]));
    }

    /// <summary>
    /// The entry used when no incorrect check has been made yet: the floor of
    /// the path. Null when the item has no scaffold.
    /// </summary>
    public ScaffoldEntry? FloorEntry() =>
        scaffold is null ? null : ScaffoldEntryResolver.Floor(scaffold);

    public ScaffoldPhasePurpose? PurposeFor(MisconceptionCode misconception) =>
        RouteFor(misconception).Value is ScaffoldEntry entry
            ? scaffold!.Step(entry.EntryStepId).Purpose
            : null;

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

        CoachingRoute route = RouteFor(latestIncorrect.Misconception);
        int routeStreak = CountLatestRouteStreak(attempt, practiceItem, route);

        return new CoachingDiagnosisProjection(
            SelectedAnswerId: latestIncorrect.SelectedAnswerId,
            Misconception: latestIncorrect.Misconception,
            Purpose: PurposeFor(latestIncorrect.Misconception),
            Route: route,
            RouteStreak: routeStreak,
            HintLevel: routeStreak == 1
                ? CoachingHintLevel.Initial
                : CoachingHintLevel.Escalated);
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

    private int CountLatestRouteStreak(
        Attempt attempt,
        PracticeItem practiceItem,
        CoachingRoute latestRoute)
    {
        int streak = 0;

        for (int index = attempt.Checks.Count - 1; index >= 0; index--)
        {
            CheckOutcome outcome = practiceItem.Evaluate(attempt.Checks[index].SelectedAnswerId);
            if (outcome.Value is not IncorrectCheck incorrect)
            {
                break;
            }

            if (!RouteFor(incorrect.Misconception).Equals(latestRoute))
            {
                break;
            }

            streak++;
        }

        return streak;
    }
}
