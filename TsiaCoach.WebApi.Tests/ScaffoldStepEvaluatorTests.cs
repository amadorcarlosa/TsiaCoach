using System.Text.Json;

using TsiaCoach.Domain.Mathematics;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.SampleScaffolds;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.Scaffolds.Evaluation;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.WebApi.Tests;

public sealed class ScaffoldStepEvaluatorTests
{
    [Test]
    public async Task EstablishRodLength_TwoUnitRodsSatisfyLengthsAreEquivalent()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.EstablishRodLengthStepId,
            new MatchEquivalentLengthSubmission(new RodCount(2)));

        await AssertSatisfied(evaluation);
    }

    [Test]
    public async Task ClassifyLengths_CompleteComputedFitMapSatisfiesCheck()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.ClassifyLengthsStepId,
            new ClassifyByFitSubmission(
            [
                new(new UnitLength(1), FitClassification.OneUnitLeftover),
                new(new UnitLength(2), FitClassification.Flush),
                new(new UnitLength(3), FitClassification.OneUnitLeftover),
                new(new UnitLength(4), FitClassification.Flush),
                new(new UnitLength(5), FitClassification.OneUnitLeftover),
                new(new UnitLength(6), FitClassification.Flush),
                new(new UnitLength(7), FitClassification.OneUnitLeftover),
                new(new UnitLength(8), FitClassification.Flush),
                new(new UnitLength(9), FitClassification.OneUnitLeftover),
                new(new UnitLength(10), FitClassification.Flush)
            ]));

        await AssertSatisfied(evaluation);
    }

    [Test]
    public async Task NameOddClass_OddIntegerDomainSatisfiesCheck()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.NameOddClassStepId,
            new NameFitClassificationSubmission(IntegerDomain.OddIntegers));

        await AssertSatisfied(evaluation);
    }

    [Test]
    public async Task TraverseOddGaps_AllFourOrderedTraversalsSatisfyCheck()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.TraverseOddGapsStepId,
            CorrectGapSubmission());

        await AssertSatisfied(evaluation);
    }

    [Test]
    public async Task StateOddStepLength_TwoSatisfiesLatentScalar()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.StateOddStepLengthStepId,
            new EnterScalarSubmission(2m));

        await AssertSatisfied(evaluation);
    }

    [Test]
    public async Task JoinKnownQuantities_AuthoredPartsSatisfyComposition()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.JoinKnownQuantitiesStepId,
            CorrectJoinSubmission());

        await AssertSatisfied(evaluation);
    }

    [Test]
    public async Task CountBaseParts_TwoSatisfiesRodCountScalar()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.CountBasePartsStepId,
            new EnterScalarSubmission(2m));

        await AssertSatisfied(evaluation);
    }

    [Test]
    public async Task MeasureRemainder_TwoSatisfiesUnitLengthScalar()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.MeasureRemainderStepId,
            new EnterScalarSubmission(2m));

        await AssertSatisfied(evaluation);
    }

    [Test]
    public async Task JoinUnknownQuantities_AuthoredPartsSatisfyComposition()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.JoinUnknownQuantitiesStepId,
            CorrectJoinSubmission());

        await AssertSatisfied(evaluation);
    }

    [Test]
    public async Task ComposeExpression_ComposedMathObjectSatisfiesCheck()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.ComposeExpressionStepId,
            new BuildExpressionSubmission(PracticeItemOne.RequestedValueComposed.MathObjectId));

        await AssertSatisfied(evaluation);
    }

    [Test]
    public async Task SimplifyExpression_SimplifiedMathObjectSatisfiesCheck()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.SimplifyExpressionStepId,
            new BuildExpressionSubmission(PracticeItemOne.RequestedValueSimplified.MathObjectId));

        await AssertSatisfied(evaluation);
    }

    [Test]
    public async Task SelectAnswer_CorrectChoiceSatisfiesCheck()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.SelectAnswerStepId,
            new SelectAnswerChoiceSubmission(PracticeItemOne.Item.CorrectAnswerId));

        await AssertSatisfied(evaluation);
    }

    [Test]
    public async Task MatchEquivalentLength_WrongRodCountIsNotSatisfied()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.EstablishRodLengthStepId,
            new MatchEquivalentLengthSubmission(new RodCount(1)));

        await AssertNotSatisfied(evaluation);
    }

    [Test]
    public async Task ClassifyByFit_WrongClassificationIsNotSatisfied()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.ClassifyLengthsStepId,
            new ClassifyByFitSubmission(
            [
                new(new UnitLength(1), FitClassification.Flush),
                new(new UnitLength(2), FitClassification.Flush),
                new(new UnitLength(3), FitClassification.OneUnitLeftover),
                new(new UnitLength(4), FitClassification.Flush),
                new(new UnitLength(5), FitClassification.OneUnitLeftover),
                new(new UnitLength(6), FitClassification.Flush),
                new(new UnitLength(7), FitClassification.OneUnitLeftover),
                new(new UnitLength(8), FitClassification.Flush),
                new(new UnitLength(9), FitClassification.OneUnitLeftover),
                new(new UnitLength(10), FitClassification.Flush)
            ]));

        await AssertNotSatisfied(evaluation);
    }

    [Test]
    public async Task NameFitClassification_WrongDomainIsNotSatisfied()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.NameOddClassStepId,
            new NameFitClassificationSubmission(IntegerDomain.EvenIntegers));

        await AssertNotSatisfied(evaluation);
    }

    [Test]
    public async Task TraverseAllGaps_IncompleteTraversalIsNotSatisfied()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.TraverseOddGapsStepId,
            new TraverseAllGapsSubmission(
            [
                new(new UnitLength(1), new UnitLength(3), ParityLadderScaffold.OddStepRodId),
                new(new UnitLength(3), new UnitLength(5), ParityLadderScaffold.OddStepRodId),
                new(new UnitLength(5), new UnitLength(7), ParityLadderScaffold.OddStepRodId)
            ]));

        await AssertNotSatisfied(evaluation);
    }

    [Test]
    public async Task TraverseAllGaps_ReversedTraversalIsNotSatisfied()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.TraverseOddGapsStepId,
            new TraverseAllGapsSubmission(
            [
                new(new UnitLength(3), new UnitLength(1), ParityLadderScaffold.OddStepRodId),
                new(new UnitLength(3), new UnitLength(5), ParityLadderScaffold.OddStepRodId),
                new(new UnitLength(5), new UnitLength(7), ParityLadderScaffold.OddStepRodId),
                new(new UnitLength(7), new UnitLength(9), ParityLadderScaffold.OddStepRodId)
            ]));

        await AssertNotSatisfied(evaluation);
    }

    [Test]
    public async Task JoinQuantities_WrongKnownPartCompositionIsNotSatisfied()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.JoinKnownQuantitiesStepId,
            new JoinQuantitiesSubmission(
            [
                new SemanticQuantityReference(PracticeItemOne.N.Id),
                new SemanticQuantityReference(PracticeItemOne.ConsecutiveOddIntegers.Id)
            ]));

        await AssertNotSatisfied(evaluation);
    }

    [Test]
    public async Task EnterScalar_WrongValueIsNotSatisfied()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.CountBasePartsStepId,
            new EnterScalarSubmission(3m));

        await AssertNotSatisfied(evaluation);
    }

    [Test]
    public async Task BuildExpression_KnownWrongMathObjectIsNotSatisfied()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.ComposeExpressionStepId,
            new BuildExpressionSubmission(new MathObjectId("math-answer-a")));

        await AssertNotSatisfied(evaluation);
    }

    [Test]
    public async Task SelectAnswerChoice_KnownDistractorIsNotSatisfied()
    {
        ScaffoldStepEvaluation evaluation = Evaluate(
            ParityLadderScaffold.SelectAnswerStepId,
            new SelectAnswerChoiceSubmission(new AnswerChoiceId("answer-a")));

        await AssertNotSatisfied(evaluation);
    }

    [Test]
    public async Task ClassifyByFitSubmission_CannotBeMutatedAfterConstruction()
    {
        var original = new FitClassificationEntry(
            new UnitLength(1),
            FitClassification.OneUnitLeftover);
        var replacement = new FitClassificationEntry(
            new UnitLength(2),
            FitClassification.Flush);
        var classifications = new List<FitClassificationEntry> { original };
        var submission = new ClassifyByFitSubmission(classifications);

        classifications[0] = replacement;
        NotSupportedException? exception = CaptureMutationFailure(
            () => ((IList<FitClassificationEntry>)submission.Classifications)[0] = replacement);

        await Assert.That(submission.Classifications[0])
            .IsEqualTo(original);
        await Assert.That(submission.Classifications is FitClassificationEntry[])
            .IsFalse();
        await Assert.That(typeof(ClassifyByFitSubmission)
                .GetProperty(nameof(ClassifyByFitSubmission.Classifications))!
                .SetMethod is null)
            .IsTrue();
        await Assert.That(exception is not null)
            .IsTrue();
    }

    [Test]
    public async Task TraverseAllGapsSubmission_CannotBeMutatedAfterConstruction()
    {
        var original = new GapTraversal(
            new UnitLength(1),
            new UnitLength(3),
            ParityLadderScaffold.OddStepRodId);
        var replacement = new GapTraversal(
            new UnitLength(3),
            new UnitLength(5),
            ParityLadderScaffold.OddStepRodId);
        var traversals = new List<GapTraversal> { original };
        var submission = new TraverseAllGapsSubmission(traversals);

        traversals[0] = replacement;
        NotSupportedException? exception = CaptureMutationFailure(
            () => ((IList<GapTraversal>)submission.Traversals)[0] = replacement);

        await Assert.That(submission.Traversals[0])
            .IsEqualTo(original);
        await Assert.That(submission.Traversals is GapTraversal[])
            .IsFalse();
        await Assert.That(typeof(TraverseAllGapsSubmission)
                .GetProperty(nameof(TraverseAllGapsSubmission.Traversals))!
                .SetMethod is null)
            .IsTrue();
        await Assert.That(exception is not null)
            .IsTrue();
    }

    [Test]
    public async Task JoinQuantitiesSubmission_CannotBeMutatedAfterConstruction()
    {
        QuantityReference original = new SemanticQuantityReference(PracticeItemOne.N.Id);
        QuantityReference replacement =
            new LatentExpressionReference(PracticeItemOne.SecondMember.Id);
        var parts = new List<QuantityReference> { original };
        var submission = new JoinQuantitiesSubmission(parts);

        parts[0] = replacement;
        NotSupportedException? exception = CaptureMutationFailure(
            () => ((IList<QuantityReference>)submission.Parts)[0] = replacement);

        await Assert.That(submission.Parts[0])
            .IsEqualTo(original);
        await Assert.That(submission.Parts is QuantityReference[])
            .IsFalse();
        await Assert.That(typeof(JoinQuantitiesSubmission)
                .GetProperty(nameof(JoinQuantitiesSubmission.Parts))!
                .SetMethod is null)
            .IsTrue();
        await Assert.That(exception is not null)
            .IsTrue();
    }

    [Test]
    public async Task Evaluate_RejectsForeignPracticeItem()
    {
        await AssertInvalid(
            "targets practice item",
            () => ScaffoldStepEvaluator.Evaluate(
                ParityLadderScaffold.Definition,
                PracticeItemTwo.Item,
                ParityLadderScaffold.SelectAnswerStepId,
                new SelectAnswerChoiceSubmission(PracticeItemOne.Item.CorrectAnswerId)));
    }

    [Test]
    public async Task Evaluate_RejectsUnknownStep()
    {
        await AssertInvalid(
            "does not exist",
            () => Evaluate(
                new ScaffoldStepId("step-unknown"),
                new SelectAnswerChoiceSubmission(PracticeItemOne.Item.CorrectAnswerId)));
    }

    [Test]
    public async Task Evaluate_RejectsSubmissionIncompatibleWithLearnerAction()
    {
        await AssertInvalid(
            "incompatible",
            () => Evaluate(
                ParityLadderScaffold.SelectAnswerStepId,
                new MatchEquivalentLengthSubmission(new RodCount(2))));
    }

    [Test]
    public async Task ClassifyByFit_RejectsDuplicateLengthEntry()
    {
        await AssertInvalid(
            "Duplicate classification",
            () => Evaluate(
                ParityLadderScaffold.ClassifyLengthsStepId,
                new ClassifyByFitSubmission(
                [
                    new(new UnitLength(1), FitClassification.OneUnitLeftover),
                    new(new UnitLength(1), FitClassification.Flush)
                ])));
    }

    [Test]
    public async Task TraverseAllGaps_RejectsUnknownResource()
    {
        await AssertInvalid(
            "does not exist",
            () => Evaluate(
                ParityLadderScaffold.TraverseOddGapsStepId,
                new TraverseAllGapsSubmission(
                [
                    new(new UnitLength(1), new UnitLength(3), new ScaffoldResourceId("resource-unknown"))
                ])));
    }

    [Test]
    public async Task JoinQuantities_RejectsUnknownSemanticEntity()
    {
        await AssertInvalid(
            "Semantic entity",
            () => Evaluate(
                ParityLadderScaffold.JoinKnownQuantitiesStepId,
                new JoinQuantitiesSubmission(
                [
                    new SemanticQuantityReference(new SemanticEntityId("entity-unknown")),
                    new LatentExpressionReference(PracticeItemOne.SecondMember.Id)
                ])));
    }

    [Test]
    public async Task JoinQuantities_RejectsUnknownLatentExpression()
    {
        await AssertInvalid(
            "Latent math",
            () => Evaluate(
                ParityLadderScaffold.JoinKnownQuantitiesStepId,
                new JoinQuantitiesSubmission(
                [
                    new SemanticQuantityReference(PracticeItemOne.N.Id),
                    new LatentExpressionReference(new LatentMathId("latent-unknown"))
                ])));
    }

    [Test]
    public async Task BuildExpression_RejectsUnknownMathObject()
    {
        await AssertInvalid(
            "Math object",
            () => Evaluate(
                ParityLadderScaffold.ComposeExpressionStepId,
                new BuildExpressionSubmission(new MathObjectId("math-unknown"))));
    }

    [Test]
    public async Task SelectAnswerChoice_RejectsUnknownAnswerChoice()
    {
        await AssertInvalid(
            "does not belong to practice item",
            () => Evaluate(
                ParityLadderScaffold.SelectAnswerStepId,
                new SelectAnswerChoiceSubmission(new AnswerChoiceId("answer-unknown"))));
    }

    [Test]
    public async Task ScaffoldCreate_RejectsUnrepresentableComputedFitRemainder()
    {
        await AssertInvalid(
            "unrepresentable fit remainder",
            () => Scaffold.Create(
                id: new ScaffoldId("scaffold-unrepresentable-fit"),
                practiceItem: PracticeItemOne.Item,
                resources:
                [
                    new RodResource(
                        Id: new ScaffoldResourceId("resource-probe"),
                        Length: new LiteralLength(new UnitLength(3)),
                        Multiplicity: ResourceMultiplicity.Singleton,
                        Role: RodRole.ProbeAndStep),
                    new RodSeriesResource(
                        Id: new ScaffoldResourceId("resource-spans"),
                        Lengths:
                        [
                            new UnitLength(1),
                            new UnitLength(2),
                            new UnitLength(3)
                        ])
                ],
                phases:
                [
                    new ScaffoldPhase(
                        Id: new ScaffoldPhaseId("phase"),
                        Purpose: ScaffoldPhasePurpose.ConceptFormation,
                        Steps:
                        [
                            new ScaffoldStep(
                                Id: new ScaffoldStepId("step"),
                                Prompt: new ScaffoldPrompt("Classify.", []),
                                Scene: new FreshScene(
                                    new RodMeasurementScene(
                                        ProbeRodId: new ScaffoldResourceId("resource-probe"),
                                        SpanSeriesId: new ScaffoldResourceId("resource-spans"))),
                                Action: new ClassifyByFit(),
                                SuccessCheck: new MatchesComputedFit())
                        ])
                ]));
    }

    [Test]
    public async Task ScaffoldCreate_RejectsGapCheckUsingDifferentRodThanScene()
    {
        await AssertInvalid(
            "must use the scene step rod",
            () => Scaffold.Create(
                id: new ScaffoldId("scaffold-gap-rod-mismatch"),
                practiceItem: PracticeItemOne.Item,
                resources: ParityLadderScaffold.Definition.Resources,
                phases:
                [
                    new ScaffoldPhase(
                        Id: new ScaffoldPhaseId("phase"),
                        Purpose: ScaffoldPhasePurpose.ConceptFormation,
                        Steps:
                        [
                            ValidClassificationStep(),
                            new ScaffoldStep(
                                Id: new ScaffoldStepId("step-gap"),
                                Prompt: new ScaffoldPrompt("Traverse gaps.", []),
                                Scene: new FreshScene(
                                    new RodGapScene(
                                        StepRodId: ParityLadderScaffold.UnitRodId,
                                        ClassificationStepId: ParityLadderScaffold.ClassifyLengthsStepId,
                                        IncludedOutcome: FitClassification.OneUnitLeftover)),
                                Action: new TraverseAllGaps(),
                                SuccessCheck: new AllGapsTraversed(
                                    ParityLadderScaffold.OddStepRodId))
                        ])
                ]));
    }

    [Test]
    public async Task ScaffoldCreate_RejectsGapSceneReferencingNonClassificationStep()
    {
        ScaffoldStepId sourceStepId = new("step-equivalence-source");

        await AssertInvalid(
            "must reference a prior classification step",
            () => Scaffold.Create(
                id: new ScaffoldId("scaffold-gap-non-classification-source"),
                practiceItem: PracticeItemOne.Item,
                resources: ParityLadderScaffold.Definition.Resources,
                phases:
                [
                    new ScaffoldPhase(
                        Id: new ScaffoldPhaseId("phase"),
                        Purpose: ScaffoldPhasePurpose.ConceptFormation,
                        Steps:
                        [
                            new ScaffoldStep(
                                Id: sourceStepId,
                                Prompt: new ScaffoldPrompt("Match rods.", []),
                                Scene: new FreshScene(
                                    new RodEquivalenceScene(
                                        UnitRodId: ParityLadderScaffold.UnitRodId,
                                        ProbeRodId: ParityLadderScaffold.OddStepRodId)),
                                Action: new MatchEquivalentLength(),
                                SuccessCheck: new LengthsAreEquivalent()),
                            new ScaffoldStep(
                                Id: new ScaffoldStepId("step-gap"),
                                Prompt: new ScaffoldPrompt("Traverse gaps.", []),
                                Scene: new FreshScene(
                                    new RodGapScene(
                                        StepRodId: ParityLadderScaffold.OddStepRodId,
                                        ClassificationStepId: sourceStepId,
                                        IncludedOutcome: FitClassification.OneUnitLeftover)),
                                Action: new TraverseAllGaps(),
                                SuccessCheck: new AllGapsTraversed(
                                    ParityLadderScaffold.OddStepRodId))
                        ])
                ]));
    }

    [Test]
    public async Task ScaffoldCreate_RejectsEvaluatorActionWithIncompatibleScene()
    {
        await AssertInvalid(
            "must use a fresh RodEquivalenceScene",
            () => Scaffold.Create(
                id: new ScaffoldId("scaffold-action-scene-mismatch"),
                practiceItem: PracticeItemOne.Item,
                resources: ParityLadderScaffold.Definition.Resources,
                phases:
                [
                    new ScaffoldPhase(
                        Id: new ScaffoldPhaseId("phase"),
                        Purpose: ScaffoldPhasePurpose.ConceptFormation,
                        Steps:
                        [
                            new ScaffoldStep(
                                Id: new ScaffoldStepId("step"),
                                Prompt: new ScaffoldPrompt("Match rods.", []),
                                Scene: new FreshScene(new AnswerChoiceScene()),
                                Action: new MatchEquivalentLength(),
                                SuccessCheck: new LengthsAreEquivalent())
                        ])
                ]));
    }

    [Test]
    public async Task EvaluationOutcome_DoesNotExposeExpectedValueOrCorrectAnswer()
    {
        ScaffoldStepEvaluation[] outcomes =
        [
            new ScaffoldStepSatisfied(),
            new ScaffoldStepNotSatisfied()
        ];

        string json = JsonSerializer.Serialize(outcomes);

        await Assert.That(json).DoesNotContain("Expected");
        await Assert.That(json).DoesNotContain("CorrectAnswer");
        await Assert.That(json).DoesNotContain("AnswerChoice");
        await Assert.That(json).DoesNotContain("Latent");
        await Assert.That(json).DoesNotContain("Value");
    }

    private static ScaffoldStepEvaluation Evaluate(
        ScaffoldStepId stepId,
        ScaffoldStepSubmission submission) =>
        ScaffoldStepEvaluator.Evaluate(
            ParityLadderScaffold.Definition,
            PracticeItemOne.Item,
            stepId,
            submission);

    private static TraverseAllGapsSubmission CorrectGapSubmission() =>
        new(
        [
            new(new UnitLength(1), new UnitLength(3), ParityLadderScaffold.OddStepRodId),
            new(new UnitLength(3), new UnitLength(5), ParityLadderScaffold.OddStepRodId),
            new(new UnitLength(5), new UnitLength(7), ParityLadderScaffold.OddStepRodId),
            new(new UnitLength(7), new UnitLength(9), ParityLadderScaffold.OddStepRodId)
        ]);

    private static JoinQuantitiesSubmission CorrectJoinSubmission() =>
        new(
        [
            new LatentExpressionReference(PracticeItemOne.SecondMember.Id),
            new SemanticQuantityReference(PracticeItemOne.N.Id)
        ]);

    private static ScaffoldStep ValidClassificationStep() =>
        new(
            Id: ParityLadderScaffold.ClassifyLengthsStepId,
            Prompt: new ScaffoldPrompt("Classify.", []),
            Scene: new FreshScene(
                new RodMeasurementScene(
                    ProbeRodId: ParityLadderScaffold.OddStepRodId,
                    SpanSeriesId: ParityLadderScaffold.MeasurandSeriesId)),
            Action: new ClassifyByFit(),
            SuccessCheck: new MatchesComputedFit());

    private static NotSupportedException? CaptureMutationFailure(Action mutate)
    {
        try
        {
            mutate();
            return null;
        }
        catch (NotSupportedException ex)
        {
            return ex;
        }
    }

    private static async Task AssertSatisfied(ScaffoldStepEvaluation evaluation)
    {
        await Assert.That(evaluation.Value).IsTypeOf<ScaffoldStepSatisfied>();
    }

    private static async Task AssertNotSatisfied(ScaffoldStepEvaluation evaluation)
    {
        await Assert.That(evaluation.Value).IsTypeOf<ScaffoldStepNotSatisfied>();
    }

    private static async Task AssertInvalid(
        string expectedMessage,
        Func<ScaffoldStepEvaluation> evaluate)
    {
        InvalidOperationException? exception = null;

        try
        {
            _ = evaluate();
        }
        catch (InvalidOperationException ex)
        {
            exception = ex;
        }

        await Assert.That(exception is not null).IsTrue();
        await Assert.That(exception!.Message).Contains(expectedMessage);
    }

    private static async Task AssertInvalid(
        string expectedMessage,
        Func<Scaffold> createScaffold)
    {
        InvalidOperationException? exception = null;

        try
        {
            _ = createScaffold();
        }
        catch (InvalidOperationException ex)
        {
            exception = ex;
        }

        await Assert.That(exception is not null).IsTrue();
        await Assert.That(exception!.Message).Contains(expectedMessage);
    }
}
