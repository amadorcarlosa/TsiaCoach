using System.Collections.ObjectModel;

using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Coaching;

/// <summary>
/// Authored routing into the item's scaffold path: a probe whose answer
/// shapes map to step ids, and a map from misconception code to step id.
/// The policy is an index into the path; it never searches for a step.
/// </summary>
public sealed class CoachingPolicy
{
    private readonly Scaffold? scaffold;

    public PracticeItemId PracticeItemId { get; }

    public IReadOnlyDictionary<MisconceptionCode, ScaffoldStepId> EntryStepByCode { get; }

    public IReadOnlySet<MisconceptionCode> AuthoredCodes { get; }

    /// <summary>The authored help probe. Null when the item has no scaffold.</summary>
    public ProbeQuestion? Probe { get; }

    /// <summary>Authored question shapes per step. Empty when the item has no scaffold.</summary>
    public IReadOnlyDictionary<ScaffoldStepId, StepQuestionSet> StepQuestions { get; }

    private CoachingPolicy(
        PracticeItemId practiceItemId,
        IReadOnlySet<MisconceptionCode> authoredCodes,
        IReadOnlyDictionary<MisconceptionCode, ScaffoldStepId> entryStepByCode,
        Scaffold? scaffold,
        ProbeQuestion? probe,
        IReadOnlyDictionary<ScaffoldStepId, StepQuestionSet> stepQuestions)
    {
        PracticeItemId = practiceItemId;
        StepQuestions = new ReadOnlyDictionary<ScaffoldStepId, StepQuestionSet>(
            new Dictionary<ScaffoldStepId, StepQuestionSet>(stepQuestions));
        AuthoredCodes = authoredCodes;
        EntryStepByCode = new ReadOnlyDictionary<MisconceptionCode, ScaffoldStepId>(
            new Dictionary<MisconceptionCode, ScaffoldStepId>(entryStepByCode));
        this.scaffold = scaffold;
        Probe = probe;
    }

    public static CoachingPolicy CreateWithScaffold(
        PracticeItem practiceItem,
        IReadOnlyDictionary<MisconceptionCode, ScaffoldStepId> entryStepByCode,
        Scaffold scaffold,
        ProbeQuestion probe,
        IReadOnlyList<StepQuestionSet> stepQuestions)
    {
        if (scaffold is null)
        {
            throw new InvalidOperationException(
                "CreateWithScaffold requires an authored scaffold; use CreateWithoutScaffold when none exists.");
        }

        CoachingPolicyValidator.Validate(practiceItem, entryStepByCode, scaffold, probe, stepQuestions);

        return new CoachingPolicy(
            practiceItem.Id,
            entryStepByCode.Keys.ToHashSet(),
            entryStepByCode,
            scaffold,
            probe,
            stepQuestions.ToDictionary(set => set.StepId));
    }

    public static CoachingPolicy CreateWithoutScaffold(PracticeItem practiceItem) =>
        new(
            practiceItem.Id,
            practiceItem.Distractors.Values.ToHashSet(),
            new Dictionary<MisconceptionCode, ScaffoldStepId>(),
            scaffold: null,
            probe: null,
            stepQuestions: new Dictionary<ScaffoldStepId, StepQuestionSet>());

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

    /// <summary>Resolves a probe answer shape to its authored entry.</summary>
    public ScaffoldEntry EntryForShape(ProbeShapeId shapeId)
    {
        if (scaffold is null || Probe is null)
        {
            throw new InvalidOperationException(
                $"Practice item '{PracticeItemId.Value}' has no probe to route from.");
        }

        return new ScaffoldEntry(scaffold.Id, Probe.Shape(shapeId).EntryStepId);
    }

    /// <summary>The authored question shapes for a step, or null when the step is not on the path.</summary>
    public StepQuestionSet? StepQuestionsFor(ScaffoldStepId stepId) =>
        StepQuestions.TryGetValue(stepId, out StepQuestionSet? set) ? set : null;

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
