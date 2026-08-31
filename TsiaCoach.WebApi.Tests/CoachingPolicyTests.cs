using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.SampleCoaching;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.SampleScaffolds;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.WebApi.Tests;

public sealed class CoachingPolicyTests
{
    [Test]
    public async Task FreshSceneStep_CanStartCold()
    {
        ScaffoldStep step = FindStep(ParityLadderScaffold.EstablishRodLengthStepId);

        await Assert.That(step.CanStartCold).IsTrue();
    }

    [Test]
    public async Task ContinuedSceneStep_CannotStartCold()
    {
        ScaffoldStep step = FindStep(ParityLadderScaffold.NameOddClassStepId);

        await Assert.That(step.CanStartCold).IsFalse();
    }

    [Test]
    public async Task ResolverWithMultipleColdSteps_SelectsFirstAuthoredStep()
    {
        ScaffoldEntry entry = ScaffoldEntryResolver.Resolve(
            ParityLadderScaffold.Definition,
            ScaffoldPhasePurpose.ConceptFormation);

        await Assert.That(entry.EntryStepId)
            .IsEqualTo(ParityLadderScaffold.EstablishRodLengthStepId);
    }

    [Test]
    public async Task PracticeItemOnePolicy_CoversEveryAuthoredMisconception()
    {
        CoachingPolicy policy = PracticeItemOneCoachingPolicy.Definition;

        await Assert.That(policy.PurposeByCode.Keys)
            .IsEquivalentTo(PracticeItemOne.Item.Distractors.Values.Distinct());
    }

    [Test]
    public async Task OrdinaryStepAndMissingSum_MapsToLanguageInterpretation()
    {
        await Assert.That(PracticeItemOneCoachingPolicy.Definition.PurposeFor(
                new("ordinary-step-and-missing-sum")))
            .IsEqualTo(ScaffoldPhasePurpose.LanguageInterpretation);
    }

    [Test]
    public async Task StoppedAtSecondInteger_MapsToRepresentation()
    {
        await Assert.That(PracticeItemOneCoachingPolicy.Definition.PurposeFor(
                new("stopped-at-second-integer")))
            .IsEqualTo(ScaffoldPhasePurpose.Representation);
    }

    [Test]
    public async Task OrdinaryStepInSum_MapsToLanguageInterpretation()
    {
        await Assert.That(PracticeItemOneCoachingPolicy.Definition.PurposeFor(
                new("ordinary-step-in-sum")))
            .IsEqualTo(ScaffoldPhasePurpose.LanguageInterpretation);
    }

    [Test]
    public async Task LanguageInterpretation_ResolvesToTraverseOddGaps()
    {
        ScaffoldEntry entry = RequireScaffoldEntry(
            PracticeItemOneCoachingPolicy.Definition.RouteFor(
                new("ordinary-step-and-missing-sum")));

        await Assert.That(entry.EntryStepId)
            .IsEqualTo(ParityLadderScaffold.TraverseOddGapsStepId);
    }

    [Test]
    public async Task Representation_ResolvesToJoinKnownQuantities()
    {
        ScaffoldEntry entry = RequireScaffoldEntry(
            PracticeItemOneCoachingPolicy.Definition.RouteFor(
                new("stopped-at-second-integer")));

        await Assert.That(entry.EntryStepId)
            .IsEqualTo(ParityLadderScaffold.JoinKnownQuantitiesStepId);
    }

    [Test]
    public async Task PracticeItemTwoPolicy_CoversEveryAuthoredMisconception()
    {
        CoachingPolicy policy = PracticeItemTwoCoachingPolicy.Definition;

        await Assert.That(policy.PurposeByCode.Keys)
            .IsEquivalentTo(PracticeItemTwo.Item.Distractors.Values.Distinct());
    }

    [Test]
    public async Task ThisYearResolvedAsW_MapsToLanguageInterpretation()
    {
        await Assert.That(PracticeItemTwoCoachingPolicy.Definition.PurposeFor(
                new("this-year-resolved-as-w")))
            .IsEqualTo(ScaffoldPhasePurpose.LanguageInterpretation);
    }

    [Test]
    public async Task StoppedAtThisYear_MapsToLanguageInterpretation()
    {
        await Assert.That(PracticeItemTwoCoachingPolicy.Definition.PurposeFor(
                new("stopped-at-this-year")))
            .IsEqualTo(ScaffoldPhasePurpose.LanguageInterpretation);
    }

    [Test]
    public async Task ScaledVariableOnly_MapsToRepresentation()
    {
        await Assert.That(PracticeItemTwoCoachingPolicy.Definition.PurposeFor(
                new("scaled-variable-only")))
            .IsEqualTo(ScaffoldPhasePurpose.Representation);
    }

    [Test]
    public async Task PracticeItemTwoDiagnoses_ReturnNoScaffoldAuthored()
    {
        foreach (MisconceptionCode code in PracticeItemTwo.Item.Distractors.Values)
        {
            CoachingRoute route = PracticeItemTwoCoachingPolicy.Definition.RouteFor(code);

            await Assert.That(route.Value is NoScaffoldAuthored).IsTrue();
        }
    }

    [Test]
    public async Task Create_RejectsMissingMisconceptionPurpose()
    {
        Dictionary<MisconceptionCode, ScaffoldPhasePurpose> map = ItemOneMap();
        map.Remove(new("ordinary-step-in-sum"));

        await AssertInvalid(() => _ = CoachingPolicy.CreateWithScaffold(
            PracticeItemOne.Item, map, ParityLadderScaffold.Definition));
    }

    [Test]
    public async Task Create_RejectsExtraMisconceptionPurpose()
    {
        Dictionary<MisconceptionCode, ScaffoldPhasePurpose> map = ItemOneMap();
        map[new("foreign-misconception")] = ScaffoldPhasePurpose.Representation;

        await AssertInvalid(() => _ = CoachingPolicy.CreateWithScaffold(
            PracticeItemOne.Item, map, ParityLadderScaffold.Definition));
    }

    [Test]
    public async Task Create_RejectsForeignScaffold()
    {
        Scaffold foreignScaffold = ParityLadderScaffold.Definition with
        {
            PracticeItemId = PracticeItemTwo.Id
        };

        await AssertInvalid(() => _ = CoachingPolicy.CreateWithScaffold(
            PracticeItemOne.Item, ItemOneMap(), foreignScaffold));
    }

    [Test]
    public async Task Create_RejectsMissingTargetPurposePhase()
    {
        Scaffold scaffold = ParityLadderScaffold.Definition with
        {
            Phases = ParityLadderScaffold.Definition.Phases
                .Where(phase => phase.Purpose != ScaffoldPhasePurpose.LanguageInterpretation)
                .ToArray()
        };

        await AssertInvalid(() => _ = CoachingPolicy.CreateWithScaffold(
            PracticeItemOne.Item, ItemOneMap(), scaffold));
    }

    [Test]
    public async Task Create_RejectsDuplicateTargetPurposePhases()
    {
        ScaffoldPhase duplicate = new(
            new("phase-duplicate-language"),
            ScaffoldPhasePurpose.LanguageInterpretation,
            []);
        Scaffold scaffold = ParityLadderScaffold.Definition with
        {
            Phases = ParityLadderScaffold.Definition.Phases
                .Append(duplicate)
                .ToArray()
        };

        await AssertInvalid(() => _ = CoachingPolicy.CreateWithScaffold(
            PracticeItemOne.Item, ItemOneMap(), scaffold));
    }

    [Test]
    public async Task Create_RejectsTargetPurposeWithoutColdStep()
    {
        ScaffoldPhase languagePhase = ParityLadderScaffold.Definition.Phases
            .Single(phase => phase.Purpose == ScaffoldPhasePurpose.LanguageInterpretation);
        ScaffoldPhase continuedOnly = languagePhase with
        {
            Steps = [languagePhase.Steps[1]]
        };
        Scaffold scaffold = ParityLadderScaffold.Definition with
        {
            Phases = ParityLadderScaffold.Definition.Phases
                .Select(phase => phase.Purpose == ScaffoldPhasePurpose.LanguageInterpretation
                    ? continuedOnly
                    : phase)
                .ToArray()
        };

        await AssertInvalid(() => _ = CoachingPolicy.CreateWithScaffold(
            PracticeItemOne.Item, ItemOneMap(), scaffold));
    }

    [Test]
    public async Task Create_DefensivelyCopiesPurposeMap()
    {
        Dictionary<MisconceptionCode, ScaffoldPhasePurpose> map = ItemOneMap();
        CoachingPolicy policy = CoachingPolicy.CreateWithScaffold(
            PracticeItemOne.Item, map, ParityLadderScaffold.Definition);

        map[new("ordinary-step-and-missing-sum")] = ScaffoldPhasePurpose.Representation;

        await Assert.That(policy.PurposeFor(new("ordinary-step-and-missing-sum")))
            .IsEqualTo(ScaffoldPhasePurpose.LanguageInterpretation);
    }

    [Test]
    public async Task PurposeFor_RejectsUnknownMisconception()
    {
        await AssertInvalid(() => _ = PracticeItemOneCoachingPolicy.Definition.PurposeFor(
            new("unknown-misconception")));
    }

    [Test]
    public async Task ProjectDiagnosis_RejectsBeforeCheck()
    {
        Attempt attempt = Attempt.Start(new("before-check"), PracticeItemOne.Item);

        await AssertInvalid(() => _ = PracticeItemOneCoachingPolicy.Definition
            .ProjectDiagnosis(attempt, PracticeItemOne.Item));
    }

    [Test]
    public async Task ProjectDiagnosis_RejectsAfterCorrectCheck()
    {
        Attempt attempt = Attempt.Start(new("after-correct"), PracticeItemOne.Item)
            .Append(new("check-1"), new("answer-d"), Timestamp(1), PracticeItemOne.Item);

        await AssertInvalid(() => _ = PracticeItemOneCoachingPolicy.Definition
            .ProjectDiagnosis(attempt, PracticeItemOne.Item));
    }

    [Test]
    public async Task ProjectDiagnosis_RejectsForeignAttemptOrItem()
    {
        Attempt foreignAttempt = Attempt.Start(new("foreign-attempt"), PracticeItemTwo.Item);

        await AssertInvalid(() => _ = PracticeItemOneCoachingPolicy.Definition
            .ProjectDiagnosis(foreignAttempt, PracticeItemTwo.Item));

        Attempt itemOneAttempt = Attempt.Start(new("foreign-item"), PracticeItemOne.Item);
        await AssertInvalid(() => _ = PracticeItemOneCoachingPolicy.Definition
            .ProjectDiagnosis(itemOneAttempt, PracticeItemTwo.Item));
    }

    [Test]
    public async Task FirstIncorrectOnRoute_UsesInitialHintLevel()
    {
        CoachingDiagnosisProjection projection = PracticeItemOneCoachingPolicy.Definition
            .ProjectDiagnosis(IncorrectAttempt("answer-a"), PracticeItemOne.Item);

        await Assert.That(projection.RouteStreak).IsEqualTo(1);
        await Assert.That(projection.HintLevel).IsEqualTo(CoachingHintLevel.Initial);
    }

    [Test]
    public async Task SecondIncorrectOnSamePurpose_UsesEscalatedHintLevel()
    {
        CoachingDiagnosisProjection projection = PracticeItemOneCoachingPolicy.Definition
            .ProjectDiagnosis(IncorrectAttempt("answer-a", "answer-c"), PracticeItemOne.Item);

        await Assert.That(projection.RouteStreak).IsEqualTo(2);
        await Assert.That(projection.HintLevel).IsEqualTo(CoachingHintLevel.Escalated);
    }

    [Test]
    public async Task DifferentPurpose_ResetsRouteStreak()
    {
        CoachingDiagnosisProjection projection = PracticeItemOneCoachingPolicy.Definition
            .ProjectDiagnosis(IncorrectAttempt("answer-a", "answer-b"), PracticeItemOne.Item);

        await Assert.That(projection.RouteStreak).IsEqualTo(1);
        await Assert.That(projection.HintLevel).IsEqualTo(CoachingHintLevel.Initial);
    }

    [Test]
    public async Task DifferentCodesOnSamePurpose_ContinueRouteStreak()
    {
        CoachingDiagnosisProjection projection = PracticeItemOneCoachingPolicy.Definition
            .ProjectDiagnosis(IncorrectAttempt("answer-a", "answer-c"), PracticeItemOne.Item);

        await Assert.That(projection.Purpose)
            .IsEqualTo(ScaffoldPhasePurpose.LanguageInterpretation);
        await Assert.That(projection.RouteStreak).IsEqualTo(2);
    }

    [Test]
    public async Task NoScaffoldDiagnosis_StillProjectsPurposeAndHintLevel()
    {
        CoachingDiagnosisProjection projection = PracticeItemTwoCoachingPolicy.Definition
            .ProjectDiagnosis(
                IncorrectAttemptFor(PracticeItemTwo.Item, "answer-a", "answer-b"),
                PracticeItemTwo.Item);

        await Assert.That(projection.Purpose)
            .IsEqualTo(ScaffoldPhasePurpose.LanguageInterpretation);
        await Assert.That(projection.Route.Value is NoScaffoldAuthored).IsTrue();
        await Assert.That(projection.RouteStreak).IsEqualTo(2);
        await Assert.That(projection.HintLevel).IsEqualTo(CoachingHintLevel.Escalated);
    }

    private static Dictionary<MisconceptionCode, ScaffoldPhasePurpose> ItemOneMap() =>
        new()
        {
            [new("ordinary-step-and-missing-sum")] = ScaffoldPhasePurpose.LanguageInterpretation,
            [new("stopped-at-second-integer")] = ScaffoldPhasePurpose.Representation,
            [new("ordinary-step-in-sum")] = ScaffoldPhasePurpose.LanguageInterpretation
        };

    private static Attempt IncorrectAttempt(params string[] answerIds)
        => IncorrectAttemptFor(PracticeItemOne.Item, answerIds);

    private static Attempt IncorrectAttemptFor(
        PracticeItem practiceItem,
        params string[] answerIds)
    {
        Attempt attempt = Attempt.Start(new("coaching-projection"), practiceItem);

        for (int index = 0; index < answerIds.Length; index++)
        {
            attempt = attempt.Append(
                new($"check-{index + 1}"),
                new(answerIds[index]),
                Timestamp(index),
                practiceItem);
        }

        return attempt;
    }

    private static DateTimeOffset Timestamp(int seconds) =>
        new(2026, 1, 1, 0, 0, seconds, TimeSpan.Zero);

    private static ScaffoldStep FindStep(ScaffoldStepId id) =>
        ParityLadderScaffold.Definition.Phases
            .SelectMany(phase => phase.Steps)
            .Single(step => step.Id == id);

    private static ScaffoldEntry RequireScaffoldEntry(CoachingRoute route) =>
        route.Value as ScaffoldEntry ?? throw new InvalidOperationException(
            $"Expected scaffold entry, found {route.Value.GetType().Name}.");

    private static async Task AssertInvalid(Action action)
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
    }
}
