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
    public async Task ParityLadder_IsAnOrderedScaffoldForPracticeItemOne()
    {
        Scaffold scaffold = ParityLadderScaffold.Definition;

        await Assert.That(scaffold.Id.Value)
            .IsEqualTo("scaffold-parity-ladder");
        await Assert.That(scaffold.PracticeItemId)
            .IsEqualTo(PracticeItemOne.Id);
        await Assert.That(scaffold.Resources.Count)
            .IsEqualTo(3);
        await Assert.That(scaffold.Phases.Count)
            .IsEqualTo(5);
        await Assert.That(scaffold.Phases.SelectMany(phase => phase.Steps).Count())
            .IsEqualTo(12);
        await Assert.That(scaffold.Phases[0].Purpose)
            .IsEqualTo(ScaffoldPhasePurpose.ConceptFormation);
        await Assert.That(scaffold.Phases[^1].Purpose)
            .IsEqualTo(ScaffoldPhasePurpose.Verification);
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

        RodMeasurementScene measure = FreshSceneFor<RodMeasurementScene>(
            FindStep(ParityLadderScaffold.ClassifyLengthsStepId));
        RodGapScene step = FreshSceneFor<RodGapScene>(
            FindStep(ParityLadderScaffold.TraverseOddGapsStepId));

        await Assert.That(measure.ProbeRodId)
            .IsEqualTo(rod.Id);
        await Assert.That(step.StepRodId)
            .IsEqualTo(rod.Id);
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
    public async Task KnownAndUnknownJoin_UseTheSameQuantitiesWithFadedSupport()
    {
        QuantityJoinScene known = FreshSceneFor<QuantityJoinScene>(
            FindStep(ParityLadderScaffold.JoinKnownQuantitiesStepId));
        QuantityJoinScene unknown = FreshSceneFor<QuantityJoinScene>(
            FindStep(ParityLadderScaffold.JoinUnknownQuantitiesStepId));

        await Assert.That(known.Parts)
            .IsEquivalentTo(unknown.Parts);
        await Assert.That(known.Bindings.Count)
            .IsEqualTo(1);
        await Assert.That(known.Bindings[0].SemanticEntityId)
            .IsEqualTo(PracticeItemOne.N.Id);
        await Assert.That(known.Bindings[0].Value)
            .IsEqualTo(new UnitLength(15));
        await Assert.That(known.ShowSizedTarget)
            .IsTrue();
        await Assert.That(unknown.Bindings.Count)
            .IsEqualTo(0);
        await Assert.That(unknown.ShowSizedTarget)
            .IsFalse();
    }

    [Test]
    public async Task FrozenKnownTrain_AsksForCountAndLengthAsDifferentReadings()
    {
        ScaffoldStep countStep = FindStep(ParityLadderScaffold.CountBasePartsStepId);
        ScaffoldStep lengthStep = FindStep(ParityLadderScaffold.MeasureRemainderStepId);

        EnterScalar countAction = RequireCase<EnterScalar>(countStep.Action.Value);
        MatchesLatentScalar countCheck =
            RequireCase<MatchesLatentScalar>(countStep.SuccessCheck.Value);
        ContinuedScene countScene = RequireCase<ContinuedScene>(countStep.Scene.Value);

        EnterScalar lengthAction = RequireCase<EnterScalar>(lengthStep.Action.Value);
        MatchesLatentScalar lengthCheck =
            RequireCase<MatchesLatentScalar>(lengthStep.SuccessCheck.Value);
        ContinuedScene lengthScene = RequireCase<ContinuedScene>(lengthStep.Scene.Value);

        await Assert.That(countScene.SourceStepId)
            .IsEqualTo(ParityLadderScaffold.JoinKnownQuantitiesStepId);
        await Assert.That(countScene.Access)
            .IsEqualTo(SceneAccess.Frozen);
        await Assert.That(countAction.Reading)
            .IsEqualTo(ScalarReading.RodCount);
        await Assert.That(countCheck.ExpectedValueId)
            .IsEqualTo(PracticeItemOne.LikeTermCount.Id);

        await Assert.That(lengthScene.SourceStepId)
            .IsEqualTo(ParityLadderScaffold.CountBasePartsStepId);
        await Assert.That(lengthScene.Access)
            .IsEqualTo(SceneAccess.Frozen);
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
        ParityLadderScaffold.Definition.Phases
            .SelectMany(phase => phase.Steps)
            .Single(step => step.Id == id);

    private static TScene FreshSceneFor<TScene>(ScaffoldStep step)
        where TScene : class
    {
        FreshScene fresh = RequireCase<FreshScene>(step.Scene.Value);
        return RequireCase<TScene>(fresh.Definition.Value);
    }

    private static T RequireCase<T>(object? value)
        where T : class =>
        value as T ?? throw new InvalidOperationException(
            $"Expected {typeof(T).Name}, found {value?.GetType().Name ?? "null"}.");
}
