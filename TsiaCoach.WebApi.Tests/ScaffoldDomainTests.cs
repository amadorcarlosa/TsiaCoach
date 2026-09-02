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
        await Assert.That(scaffold.Steps.Count)
            .IsEqualTo(6);
        await Assert.That(scaffold.Steps.Select(step => step.Id).Distinct().Count())
            .IsEqualTo(6);
        await Assert.That(scaffold.Steps.Select(step => step.Id))
            .IsEquivalentTo(
            [
                ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
                ParityLadderScaffold.RemovePairedEvensStepId,
                ParityLadderScaffold.SelectConsecutiveOddsStepId,
                ParityLadderScaffold.JoinAndReadSumStepId,
                ParityLadderScaffold.NameBarCountStepId,
                ParityLadderScaffold.NameLeftoverLengthStepId
            ]);
    }

    [Test]
    public async Task FloorStep_IsWhatMakesANumberOdd()
    {
        ScaffoldStep floor = ParityLadderScaffold.Definition.FloorStep;

        await Assert.That(floor.Id)
            .IsEqualTo(ParityLadderScaffold.RebuildFromTwosAndOnesStepId);
        await Assert.That(floor.Purpose)
            .IsEqualTo(ScaffoldPhasePurpose.ConceptFormation);
        await Assert.That(floor.Action.Value).IsTypeOf<ClassifyByFit>();
        await Assert.That(floor.SuccessCheck.Value).IsTypeOf<MatchesComputedFit>();
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
            ScaffoldPhasePurpose.LanguageInterpretation,
            ScaffoldPhasePurpose.Representation,
            ScaffoldPhasePurpose.Generalization,
            ScaffoldPhasePurpose.Generalization
        ]);
    }

    [Test]
    public async Task EveryStep_RendersFromResourcesAlone()
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
                AnswerChoiceScene => true,
                _ => false
            };

            await Assert.That(selfContained).IsTrue();
        }
    }

    [Test]
    public async Task ProbeAndStepRod_IsOneSingletonBackedByOrderedStep()
    {
        RodResource rod = ParityLadderScaffold.Definition.Resources
            .Select(resource => resource.Value)
            .OfType<RodResource>()
            .Single(resource => resource.Id == ParityLadderScaffold.OddStepRodId);
        LatentLengthReference length = RequireCase<LatentLengthReference>(rod.Length.Value);

        await Assert.That(rod.Multiplicity)
            .IsEqualTo(ResourceMultiplicity.Singleton);
        await Assert.That(rod.Role)
            .IsEqualTo(RodRole.ProbeAndStep);
        await Assert.That(length.LatentMathId)
            .IsEqualTo(PracticeItemOne.OrderedStep.Id);

        RodMeasurementScene measure = SceneFor<RodMeasurementScene>(
            FindStep(ParityLadderScaffold.RebuildFromTwosAndOnesStepId));
        RodGapScene gap = SceneFor<RodGapScene>(
            FindStep(ParityLadderScaffold.SelectConsecutiveOddsStepId));

        await Assert.That(measure.ProbeRodId)
            .IsEqualTo(rod.Id);
        await Assert.That(gap.StepRodId)
            .IsEqualTo(rod.Id);
        await Assert.That(gap.SpanSeriesId)
            .IsEqualTo(ParityLadderScaffold.MeasurandSeriesId);
        await Assert.That(gap.IncludedOutcome)
            .IsEqualTo(FitClassification.OneUnitLeftover);
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
