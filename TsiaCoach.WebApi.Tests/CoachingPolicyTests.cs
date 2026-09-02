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
    public async Task Resolver_AcceptsAnyStepOnThePath()
    {
        foreach (ScaffoldStep step in ParityLadderScaffold.Definition.Steps)
        {
            ScaffoldEntry entry = ScaffoldEntryResolver.Resolve(
                ParityLadderScaffold.Definition,
                step.Id);

            await Assert.That(entry.ScaffoldId)
                .IsEqualTo(ParityLadderScaffold.Definition.Id);
            await Assert.That(entry.EntryStepId).IsEqualTo(step.Id);
        }
    }

    [Test]
    public async Task Resolver_RejectsUnknownStep()
    {
        await AssertInvalid(() => _ = ScaffoldEntryResolver.Resolve(
            ParityLadderScaffold.Definition,
            new ScaffoldStepId("step-not-on-path")));
    }

    [Test]
    public async Task Floor_IsTheFirstStepOfThePath()
    {
        ScaffoldEntry floor = ScaffoldEntryResolver.Floor(ParityLadderScaffold.Definition);

        await Assert.That(floor.EntryStepId)
            .IsEqualTo(ParityLadderScaffold.RebuildFromTwosAndOnesStepId);
        await Assert.That(PracticeItemOneCoachingPolicy.Definition.FloorEntry())
            .IsEqualTo(floor);
    }

    [Test]
    public async Task PracticeItemOnePolicy_CoversEveryAuthoredMisconception()
    {
        CoachingPolicy policy = PracticeItemOneCoachingPolicy.Definition;

        await Assert.That(policy.EntryStepByCode.Keys)
            .IsEquivalentTo(PracticeItemOne.Item.Distractors.Values.Distinct());
        await Assert.That(policy.HasScaffold).IsTrue();
    }

    [Test]
    public async Task OrdinaryStepAndMissingSum_LandsOnSelectConsecutiveOdds()
    {
        await Assert.That(EntryStepFor(new("ordinary-step-and-missing-sum")))
            .IsEqualTo(ParityLadderScaffold.SelectConsecutiveOddsStepId);
    }

    [Test]
    public async Task StoppedAtSecondInteger_LandsOnJoinAndReadSum()
    {
        await Assert.That(EntryStepFor(new("stopped-at-second-integer")))
            .IsEqualTo(ParityLadderScaffold.JoinAndReadSumStepId);
    }

    [Test]
    public async Task OrdinaryStepInSum_LandsOnSelectConsecutiveOdds()
    {
        await Assert.That(EntryStepFor(new("ordinary-step-in-sum")))
            .IsEqualTo(ParityLadderScaffold.SelectConsecutiveOddsStepId);
    }

    [Test]
    public async Task Purpose_IsTheLabelOfTheEntryStep()
    {
        await Assert.That(PracticeItemOneCoachingPolicy.Definition.PurposeFor(
                new("stopped-at-second-integer")))
            .IsEqualTo(ScaffoldPhasePurpose.Representation);
        await Assert.That(PracticeItemOneCoachingPolicy.Definition.PurposeFor(
                new("ordinary-step-in-sum")))
            .IsEqualTo(ScaffoldPhasePurpose.LanguageInterpretation);
    }

    [Test]
    public async Task PracticeItemTwoPolicy_CoversEveryAuthoredMisconception()
    {
        CoachingPolicy policy = PracticeItemTwoCoachingPolicy.Definition;

        await Assert.That(policy.AuthoredCodes)
            .IsEquivalentTo(PracticeItemTwo.Item.Distractors.Values.Distinct());
        await Assert.That(policy.HasScaffold).IsFalse();
        await Assert.That(policy.FloorEntry()).IsNull();
    }

    [Test]
    public async Task PracticeItemTwoDiagnoses_ReturnNoScaffoldAuthored()
    {
        foreach (MisconceptionCode code in PracticeItemTwo.Item.Distractors.Values)
        {
            CoachingRoute route = PracticeItemTwoCoachingPolicy.Definition.RouteFor(code);

            await Assert.That(route.Value is NoScaffoldAuthored).IsTrue();
            await Assert.That(PracticeItemTwoCoachingPolicy.Definition.PurposeFor(code))
                .IsNull();
        }
    }

    [Test]
    public async Task Create_RejectsMissingMisconception()
    {
        Dictionary<MisconceptionCode, ScaffoldStepId> map = ItemOneMap();
        map.Remove(new("ordinary-step-in-sum"));

        await AssertInvalid(() => _ = CoachingPolicy.CreateWithScaffold(
            PracticeItemOne.Item, map, ParityLadderScaffold.Definition));
    }

    [Test]
    public async Task Create_RejectsExtraMisconception()
    {
        Dictionary<MisconceptionCode, ScaffoldStepId> map = ItemOneMap();
        map[new("foreign-misconception")] = ParityLadderScaffold.JoinAndReadSumStepId;

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
    public async Task Create_RejectsEntryStepNotOnThePath()
    {
        Dictionary<MisconceptionCode, ScaffoldStepId> map = ItemOneMap();
        map[new("stopped-at-second-integer")] = new ScaffoldStepId("step-not-on-path");

        await AssertInvalid(() => _ = CoachingPolicy.CreateWithScaffold(
            PracticeItemOne.Item, map, ParityLadderScaffold.Definition));
    }

    [Test]
    public async Task Create_DefensivelyCopiesEntryMap()
    {
        Dictionary<MisconceptionCode, ScaffoldStepId> map = ItemOneMap();
        CoachingPolicy policy = CoachingPolicy.CreateWithScaffold(
            PracticeItemOne.Item, map, ParityLadderScaffold.Definition);

        map[new("ordinary-step-and-missing-sum")] = ParityLadderScaffold.JoinAndReadSumStepId;

        await Assert.That(RequireScaffoldEntry(policy.RouteFor(
                new("ordinary-step-and-missing-sum"))).EntryStepId)
            .IsEqualTo(ParityLadderScaffold.SelectConsecutiveOddsStepId);
    }

    [Test]
    public async Task RouteFor_RejectsUnknownMisconception()
    {
        await AssertInvalid(() => _ = PracticeItemOneCoachingPolicy.Definition.RouteFor(
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
        await Assert.That(RequireScaffoldEntry(projection.Route).EntryStepId)
            .IsEqualTo(ParityLadderScaffold.SelectConsecutiveOddsStepId);
    }

    [Test]
    public async Task SecondIncorrectOnSameRoute_UsesEscalatedHintLevel()
    {
        CoachingDiagnosisProjection projection = PracticeItemOneCoachingPolicy.Definition
            .ProjectDiagnosis(IncorrectAttempt("answer-a", "answer-c"), PracticeItemOne.Item);

        await Assert.That(projection.RouteStreak).IsEqualTo(2);
        await Assert.That(projection.HintLevel).IsEqualTo(CoachingHintLevel.Escalated);
    }

    [Test]
    public async Task DifferentRoute_ResetsRouteStreak()
    {
        CoachingDiagnosisProjection projection = PracticeItemOneCoachingPolicy.Definition
            .ProjectDiagnosis(IncorrectAttempt("answer-a", "answer-b"), PracticeItemOne.Item);

        await Assert.That(projection.RouteStreak).IsEqualTo(1);
        await Assert.That(projection.HintLevel).IsEqualTo(CoachingHintLevel.Initial);
    }

    [Test]
    public async Task DifferentCodesOnSameRoute_ContinueRouteStreak()
    {
        CoachingDiagnosisProjection projection = PracticeItemOneCoachingPolicy.Definition
            .ProjectDiagnosis(IncorrectAttempt("answer-a", "answer-c"), PracticeItemOne.Item);

        await Assert.That(projection.Purpose)
            .IsEqualTo(ScaffoldPhasePurpose.LanguageInterpretation);
        await Assert.That(projection.RouteStreak).IsEqualTo(2);
    }

    [Test]
    public async Task NoScaffoldDiagnosis_StillProjectsHintLevel()
    {
        CoachingDiagnosisProjection projection = PracticeItemTwoCoachingPolicy.Definition
            .ProjectDiagnosis(
                IncorrectAttemptFor(PracticeItemTwo.Item, "answer-a", "answer-b"),
                PracticeItemTwo.Item);

        await Assert.That(projection.Purpose).IsNull();
        await Assert.That(projection.Route.Value is NoScaffoldAuthored).IsTrue();
        await Assert.That(projection.RouteStreak).IsEqualTo(2);
        await Assert.That(projection.HintLevel).IsEqualTo(CoachingHintLevel.Escalated);
    }

    private static ScaffoldStepId EntryStepFor(MisconceptionCode code) =>
        RequireScaffoldEntry(PracticeItemOneCoachingPolicy.Definition.RouteFor(code)).EntryStepId;

    private static Dictionary<MisconceptionCode, ScaffoldStepId> ItemOneMap() =>
        new()
        {
            [new("ordinary-step-and-missing-sum")] = ParityLadderScaffold.SelectConsecutiveOddsStepId,
            [new("stopped-at-second-integer")] = ParityLadderScaffold.JoinAndReadSumStepId,
            [new("ordinary-step-in-sum")] = ParityLadderScaffold.SelectConsecutiveOddsStepId
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
