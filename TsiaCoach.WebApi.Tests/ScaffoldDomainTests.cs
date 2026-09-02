using TsiaCoach.Domain.Mathematics;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.SampleScaffolds;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.WebApi.Tests;

public sealed class ScaffoldDomainTests
{
    [Test]
    public async Task ParityLadder_IsOneFlatPathForPracticeItemOne()
    {
        Scaffold scaffold = ParityLadderScaffold.Definition;

        await Assert.That(scaffold.Id.Value)
            .IsEqualTo("scaffold-parity-ladder");
        await Assert.That(scaffold.PracticeItemId)
            .IsEqualTo(PracticeItemOne.Id);
        await Assert.That(scaffold.Resources.Count)
            .IsEqualTo(3);
        await Assert.That(scaffold.Steps.Select(step => step.Id))
            .IsEquivalentTo(
            [
                ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
                ParityLadderScaffold.ContrastPairStepId,
                ParityLadderScaffold.MarkTheWhitesStepId,
                ParityLadderScaffold.SortPairedEvensStepId,
                ParityLadderScaffold.SelectConsecutiveOddsStepId,
                ParityLadderScaffold.FillTheGapStepId,
                ParityLadderScaffold.NameTheSmallerStepId,
                ParityLadderScaffold.JoinAndReadSumStepId,
                ParityLadderScaffold.NameBarCountStepId,
                ParityLadderScaffold.NameLeftoverLengthStepId
            ]);
        await Assert.That(scaffold.Steps.Select(step => step.Id).Distinct().Count())
            .IsEqualTo(scaffold.Steps.Count);
    }

    [Test]
    public async Task FloorStep_IsWhatMakesANumberOdd()
    {
        ScaffoldStep floor = ParityLadderScaffold.Definition.FloorStep;

        await Assert.That(floor.Id)
            .IsEqualTo(ParityLadderScaffold.RebuildFromTwosAndOnesStepId);
        await Assert.That(floor.Purpose)
            .IsEqualTo(ScaffoldPhasePurpose.ConceptFormation);
        await Assert.That(floor.EntryOnly).IsFalse();

        GridScene scene = SceneFor<GridScene>(floor);
        PlacePieces action = RequireCase<PlacePieces>(floor.Action.Value);
        MatchesRowCompositions check = RequireCase<MatchesRowCompositions>(floor.SuccessCheck.Value);

        await Assert.That(scene.Reference.Select(piece => piece.Length))
            .IsEquivalentTo(Enumerable.Range(1, 10));
        await Assert.That(scene.Reference.All(piece => piece.Y == piece.Length && piece.X == 1)).IsTrue();
        await Assert.That(scene.TargetRows.Count).IsEqualTo(10);
        await Assert.That(action.AllowedLengths).IsEquivalentTo(new[] { 2, 1 });
        await Assert.That(check.StepLength).IsEqualTo(2);
    }

    [Test]
    public async Task SideSteps_AreEntryOnlyAndSkippedInOrdinaryProgress()
    {
        Scaffold scaffold = ParityLadderScaffold.Definition;

        await Assert.That(scaffold.Step(ParityLadderScaffold.ContrastPairStepId).EntryOnly).IsTrue();
        await Assert.That(scaffold.Step(ParityLadderScaffold.MarkTheWhitesStepId).EntryOnly).IsTrue();

        IReadOnlyList<ScaffoldStep> fromFloor = scaffold.PathFrom(ParityLadderScaffold.RebuildFromTwosAndOnesStepId);
        await Assert.That(fromFloor.Select(step => step.Id))
            .IsEquivalentTo(
            [
                ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
                ParityLadderScaffold.SortPairedEvensStepId,
                ParityLadderScaffold.SelectConsecutiveOddsStepId,
                ParityLadderScaffold.FillTheGapStepId,
                ParityLadderScaffold.NameTheSmallerStepId,
                ParityLadderScaffold.JoinAndReadSumStepId,
                ParityLadderScaffold.NameBarCountStepId,
                ParityLadderScaffold.NameLeftoverLengthStepId
            ]);

        IReadOnlyList<ScaffoldStep> fromContrast = scaffold.PathFrom(ParityLadderScaffold.ContrastPairStepId);
        await Assert.That(fromContrast[0].Id).IsEqualTo(ParityLadderScaffold.ContrastPairStepId);
        await Assert.That(fromContrast[1].Id).IsEqualTo(ParityLadderScaffold.SortPairedEvensStepId);
    }

    [Test]
    public async Task PurposesAreLabelsInPathOrder()
    {
        ScaffoldPhasePurpose[] purposes = ParityLadderScaffold.Definition.Steps
            .Select(step => step.Purpose)
            .ToArray();

        await Assert.That(purposes).IsEquivalentTo(
        [
            ScaffoldPhasePurpose.ConceptFormation,
            ScaffoldPhasePurpose.ConceptFormation,
            ScaffoldPhasePurpose.ConceptFormation,
            ScaffoldPhasePurpose.ConceptFormation,
            ScaffoldPhasePurpose.LanguageInterpretation,
            ScaffoldPhasePurpose.LanguageInterpretation,
            ScaffoldPhasePurpose.Representation,
            ScaffoldPhasePurpose.Representation,
            ScaffoldPhasePurpose.Generalization,
            ScaffoldPhasePurpose.Generalization
        ]);
    }

    [Test]
    public async Task EveryStep_RendersFromItsOwnScene()
    {
        Scaffold scaffold = ParityLadderScaffold.Definition;
        HashSet<ScaffoldResourceId> resourceIds = scaffold.Resources
            .Select(resource => resource.Value switch
            {
                RodResource rod => rod.Id,
                RodSeriesResource series => series.Id,
                _ => throw new InvalidOperationException("Unsupported resource.")
            })
            .ToHashSet();

        foreach (ScaffoldStep step in scaffold.Steps)
        {
            bool selfContained = step.Scene.Value switch
            {
                RodEquivalenceScene scene =>
                    resourceIds.Contains(scene.UnitRodId) && resourceIds.Contains(scene.ProbeRodId),
                RodMeasurementScene scene =>
                    resourceIds.Contains(scene.ProbeRodId) && resourceIds.Contains(scene.SpanSeriesId),
                RodGapScene scene =>
                    resourceIds.Contains(scene.StepRodId) && resourceIds.Contains(scene.SpanSeriesId),
                QuantityJoinScene scene => scene.Parts.Count >= 2,
                GridScene scene => scene.Reference.Count > 0 &&
                    scene.Reference.All(piece => piece.X + piece.Length <= scene.Cols && piece.Y < scene.Rows),
                AnswerChoiceScene => true,
                _ => false
            };

            await Assert.That(selfContained).IsTrue();
        }
    }

    [Test]
    public async Task SortStep_MovesOnlyTheRedOnlyRows()
    {
        ScaffoldStep step = ParityLadderScaffold.Definition.Step(ParityLadderScaffold.SortPairedEvensStepId);
        GridScene scene = SceneFor<GridScene>(step);
        MoveRows action = RequireCase<MoveRows>(step.Action.Value);
        MatchesRowPartition check = RequireCase<MatchesRowPartition>(step.SuccessCheck.Value);

        await Assert.That(action.CompareColumn).IsEqualTo(12);
        await Assert.That(check.ExpectedMovedRows).IsEquivalentTo(new[] { 2, 4, 6, 8, 10 });

        foreach (int row in check.ExpectedMovedRows)
        {
            await Assert.That(scene.Reference.Where(piece => piece.Y == row).All(piece => piece.Length == 2)).IsTrue();
        }

        foreach (int row in new[] { 1, 3, 5, 7, 9 })
        {
            await Assert.That(scene.Reference.Where(piece => piece.Y == row).Count(piece => piece.Length == 1)).IsEqualTo(1);
        }
    }

    [Test]
    public async Task ConsecutiveStep_OffersOnlyOddRowsAndAcceptsNeighbours()
    {
        ScaffoldStep step = ParityLadderScaffold.Definition.Step(ParityLadderScaffold.SelectConsecutiveOddsStepId);
        GridScene scene = SceneFor<GridScene>(step);
        MatchesRowSelection check = RequireCase<MatchesRowSelection>(step.SuccessCheck.Value);

        await Assert.That(scene.Reference.Select(piece => piece.Y).Distinct())
            .IsEquivalentTo(new[] { 1, 3, 5, 7, 9 });
        await Assert.That(check.SelectableRows).IsEquivalentTo(new[] { 1, 3, 5, 7, 9 });
        await Assert.That(check.RequiredCount).IsEqualTo(2);
        await Assert.That(check.Rule).IsEqualTo(SelectionRule.AdjacentInList);
    }

    [Test]
    public async Task RedRodFit_SeparatesOneThroughTenByParity()
    {
        UnitLength red = new(2);
        FitOutcome sixOutcome = RodFit.Measure(red, new(6));
        FitOutcome sevenOutcome = RodFit.Measure(red, new(7));

        FlushFit six = RequireCase<FlushFit>(sixOutcome.Value);
        RemainderFit seven = RequireCase<RemainderFit>(sevenOutcome.Value);

        await Assert.That(six.CompleteRods)
            .IsEqualTo(new RodCount(3));
        await Assert.That(seven.CompleteRods)
            .IsEqualTo(new RodCount(3));
        await Assert.That(seven.Remainder)
            .IsEqualTo(new UnitLength(1));

        string classifications = string.Join(
            ",",
            Enumerable.Range(1, 10)
                .Select(length => RodFit.Measure(red, new(length)).Value)
                .Select(value => value is FlushFit ? "flush" : "leftover"));

        await Assert.That(classifications)
            .IsEqualTo(
                "leftover,flush,leftover,flush,leftover,flush,leftover,flush,leftover,flush");
    }

    [Test]
    public async Task SumScene_JoinsNAndTheNextOddIntegerWithoutBindings()
    {
        QuantityJoinScene join = SceneFor<QuantityJoinScene>(
            FindStep(ParityLadderScaffold.JoinAndReadSumStepId));
        QuantityJoinScene count = SceneFor<QuantityJoinScene>(
            FindStep(ParityLadderScaffold.NameBarCountStepId));
        QuantityJoinScene length = SceneFor<QuantityJoinScene>(
            FindStep(ParityLadderScaffold.NameLeftoverLengthStepId));

        await Assert.That(join.Parts.Count).IsEqualTo(2);
        await Assert.That(RequireCase<SemanticQuantityReference>(join.Parts[0].Value).SemanticEntityId)
            .IsEqualTo(PracticeItemOne.N.Id);
        await Assert.That(RequireCase<LatentExpressionReference>(join.Parts[1].Value).LatentMathId)
            .IsEqualTo(PracticeItemOne.SecondMember.Id);
        await Assert.That(join.Bindings.Count).IsEqualTo(0);
        await Assert.That(join.ShowSizedTarget).IsFalse();
        await Assert.That(count.Parts).IsEquivalentTo(join.Parts);
        await Assert.That(length.Parts).IsEquivalentTo(join.Parts);
    }

    [Test]
    public async Task NamingSteps_ReadCountAndLengthAsDifferentReadings()
    {
        ScaffoldStep countStep = FindStep(ParityLadderScaffold.NameBarCountStepId);
        ScaffoldStep lengthStep = FindStep(ParityLadderScaffold.NameLeftoverLengthStepId);

        EnterScalar countAction = RequireCase<EnterScalar>(countStep.Action.Value);
        MatchesLatentScalar countCheck =
            RequireCase<MatchesLatentScalar>(countStep.SuccessCheck.Value);
        EnterScalar lengthAction = RequireCase<EnterScalar>(lengthStep.Action.Value);
        MatchesLatentScalar lengthCheck =
            RequireCase<MatchesLatentScalar>(lengthStep.SuccessCheck.Value);

        await Assert.That(countAction.Reading)
            .IsEqualTo(ScalarReading.RodCount);
        await Assert.That(countCheck.ExpectedValueId)
            .IsEqualTo(PracticeItemOne.LikeTermCount.Id);
        await Assert.That(lengthAction.Reading)
            .IsEqualTo(ScalarReading.UnitLength);
        await Assert.That(lengthCheck.ExpectedValueId)
            .IsEqualTo(PracticeItemOne.OrderedStep.Id);
    }

    [Test]
    public async Task PracticeItemOne_ExposesComposedAndSimplifiedMathematics()
    {
        DerivedExpression secondMember = PracticeItemOne.Semantics.LatentFacts
            .Select(fact => fact.Value)
            .OfType<DerivedExpression>()
            .Single(fact => fact.Id == PracticeItemOne.SecondMember.Id);
        DerivedScalar likeTermCount = PracticeItemOne.Semantics.LatentFacts
            .Select(fact => fact.Value)
            .OfType<DerivedScalar>()
            .Single(fact => fact.Id == PracticeItemOne.LikeTermCount.Id);
        MathObject composed = PracticeItemOne.Mathematics.Objects
            .Single(value => value.Id == PracticeItemOne.RequestedValueComposed.MathObjectId);
        MathNode composedRoot = composed.Nodes
            .Single(node => node.Id == composed.RootNodeId);

        await Assert.That(secondMember.Meaning)
            .IsEqualTo(LatentExpressionMeaning.QuantityDefinition);
        await Assert.That(likeTermCount.Meaning)
            .IsEqualTo(LatentScalarMeaning.LikeTermCount);
        await Assert.That(likeTermCount.Value)
            .IsEqualTo(2m);
        await Assert.That(composedRoot.Kind)
            .IsEqualTo(MathNodeKind.Addition);
        await Assert.That(PracticeItemOne.RequestedValueSimplified.Provenance.SourceLatentMathIds)
            .Contains(PracticeItemOne.LikeTermCount.Id);
        await Assert.That(PracticeItemOne.RequestedValueSimplified.Provenance.SourceLatentMathIds)
            .Contains(PracticeItemOne.OrderedStep.Id);
    }

    private static ScaffoldStep FindStep(ScaffoldStepId id) =>
        ParityLadderScaffold.Definition.Step(id);

    private static TScene SceneFor<TScene>(ScaffoldStep step)
        where TScene : class =>
        RequireCase<TScene>(step.Scene.Value);

    private static T RequireCase<T>(object? value)
        where T : class =>
        value as T ?? throw new InvalidOperationException(
            $"Expected {typeof(T).Name}, found {value?.GetType().Name ?? "null"}.");
}
