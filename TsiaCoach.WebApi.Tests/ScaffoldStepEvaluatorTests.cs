using System.Text.Json;

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
    // ------------------------------------------------------------ step 1: rebuild

    [Test]
    public async Task Rebuild_CompleteCompositionOnEveryRowIsSatisfied()
    {
        await AssertOutcome<ScaffoldStepSatisfied>(Evaluate(
            ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
            ScaffoldSessionTestData.CompleteRebuildSubmission()));
    }

    [Test]
    public async Task Rebuild_LegalPartialIsAccepted()
    {
        await AssertOutcome<ScaffoldStepAccepted>(Evaluate(
            ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
            new PlacePiecesSubmission([new PlacedPiece(2, 1, 5), new PlacedPiece(2, 1, 8)])));
    }

    [Test]
    public async Task Rebuild_EmptyBoardIsAccepted()
    {
        await AssertOutcome<ScaffoldStepAccepted>(Evaluate(
            ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
            new PlacePiecesSubmission([])));
    }

    [Test]
    public async Task Rebuild_WhiteWhereATwoFitsIsRejected()
    {
        // Row 4 is even: no white belongs on it at all.
        await AssertOutcome<ScaffoldStepNotSatisfied>(Evaluate(
            ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
            new PlacePiecesSubmission([new PlacedPiece(1, 1, 4)])));
    }

    [Test]
    public async Task Rebuild_SecondWhiteOnAnOddRowIsRejected()
    {
        await AssertOutcome<ScaffoldStepNotSatisfied>(Evaluate(
            ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
            new PlacePiecesSubmission([new PlacedPiece(1, 1, 5), new PlacedPiece(1, 2, 5)])));
    }

    [Test]
    public async Task Rebuild_PiecePastTheRodIsRejected()
    {
        // Row 3 spans columns 1..3; a red at 3 would end at 5.
        await AssertOutcome<ScaffoldStepNotSatisfied>(Evaluate(
            ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
            new PlacePiecesSubmission([new PlacedPiece(2, 3, 3)])));
    }

    [Test]
    public async Task Rebuild_OverlappingPiecesAreRejected()
    {
        await AssertOutcome<ScaffoldStepNotSatisfied>(Evaluate(
            ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
            new PlacePiecesSubmission([new PlacedPiece(2, 1, 6), new PlacedPiece(2, 2, 6)])));
    }

    [Test]
    public async Task Rebuild_PieceOffAnyTargetRowIsRejected()
    {
        await AssertOutcome<ScaffoldStepNotSatisfied>(Evaluate(
            ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
            new PlacePiecesSubmission([new PlacedPiece(2, 1, 11)])));
    }

    [Test]
    public async Task Rebuild_CompositionWithAGapIsAcceptedNotComplete()
    {
        // Row 6 holds its three reds but the first sits at column 3, not 1.
        PlacedPiece[] pieces = ScaffoldSessionTestData.CompleteRebuildSubmission().Pieces
            .Where(piece => piece.Y != 6)
            .Append(new PlacedPiece(2, 3, 6))
            .Append(new PlacedPiece(2, 5, 6))
            .ToArray();

        await AssertOutcome<ScaffoldStepAccepted>(Evaluate(
            ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
            new PlacePiecesSubmission(pieces)));
    }

    [Test]
    public async Task Rebuild_RejectsALengthTheStepDoesNotOffer()
    {
        await AssertInvalid(
            "not allowed",
            () => Evaluate(
                ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
                new PlacePiecesSubmission([new PlacedPiece(3, 1, 3)])));
    }

    // ------------------------------------------------------------ step 1b and 1c landings

    [Test]
    public async Task ContrastPair_EightAndNineRebuiltIsSatisfied()
    {
        await AssertOutcome<ScaffoldStepSatisfied>(Evaluate(
            ParityLadderScaffold.ContrastPairStepId,
            new PlacePiecesSubmission(
            [
                .. ParityLadderScaffold.Composition(8, startX: 1, y: 2).Select(ToPlaced),
                .. ParityLadderScaffold.Composition(9, startX: 1, y: 4).Select(ToPlaced)
            ])));
    }

    [Test]
    public async Task MarkTheWhites_AllOddRowsIsSatisfiedAndAnEvenRowIsRejected()
    {
        await AssertOutcome<ScaffoldStepSatisfied>(Evaluate(
            ParityLadderScaffold.MarkTheWhitesStepId,
            new SelectRowsSubmission([1, 3, 5, 7, 9])));
        await AssertOutcome<ScaffoldStepAccepted>(Evaluate(
            ParityLadderScaffold.MarkTheWhitesStepId,
            new SelectRowsSubmission([1, 3])));
        await AssertOutcome<ScaffoldStepNotSatisfied>(Evaluate(
            ParityLadderScaffold.MarkTheWhitesStepId,
            new SelectRowsSubmission([1, 2])));
    }

    // ------------------------------------------------------------ step 2: sort

    [Test]
    public async Task Sort_AllRedOnlyRowsMovedIsSatisfied()
    {
        await AssertOutcome<ScaffoldStepSatisfied>(Evaluate(
            ParityLadderScaffold.SortPairedEvensStepId,
            ScaffoldSessionTestData.SortEvensSubmission()));
    }

    [Test]
    public async Task Sort_SomeRedOnlyRowsMovedIsAccepted()
    {
        await AssertOutcome<ScaffoldStepAccepted>(Evaluate(
            ParityLadderScaffold.SortPairedEvensStepId,
            new MoveRowsSubmission([2, 4])));
    }

    [Test]
    public async Task Sort_MovingAWhiteEndedRowIsRejected()
    {
        await AssertOutcome<ScaffoldStepNotSatisfied>(Evaluate(
            ParityLadderScaffold.SortPairedEvensStepId,
            new MoveRowsSubmission([2, 3])));
    }

    [Test]
    public async Task Sort_RejectsARowWithNothingOnIt()
    {
        await AssertInvalid(
            "nothing to move",
            () => Evaluate(
                ParityLadderScaffold.SortPairedEvensStepId,
                new MoveRowsSubmission([11])));
    }

    // ------------------------------------------------------------ step 3: consecutive odds

    [Test]
    public async Task Consecutive_NeighbouringOddsAreSatisfied()
    {
        foreach ((int first, int second) in new[] { (1, 3), (3, 5), (5, 7), (7, 9), (9, 7) })
        {
            await AssertOutcome<ScaffoldStepSatisfied>(Evaluate(
                ParityLadderScaffold.SelectConsecutiveOddsStepId,
                new SelectRowsSubmission([first, second])));
        }
    }

    [Test]
    public async Task Consecutive_FirstClickIsAccepted()
    {
        await AssertOutcome<ScaffoldStepAccepted>(Evaluate(
            ParityLadderScaffold.SelectConsecutiveOddsStepId,
            new SelectRowsSubmission([3])));
    }

    [Test]
    public async Task Consecutive_NonNeighboursTooManyOrEvenRowsAreRejected()
    {
        await AssertOutcome<ScaffoldStepNotSatisfied>(Evaluate(
            ParityLadderScaffold.SelectConsecutiveOddsStepId,
            new SelectRowsSubmission([3, 7])));
        await AssertOutcome<ScaffoldStepNotSatisfied>(Evaluate(
            ParityLadderScaffold.SelectConsecutiveOddsStepId,
            new SelectRowsSubmission([3, 5, 7])));
        await AssertOutcome<ScaffoldStepNotSatisfied>(Evaluate(
            ParityLadderScaffold.SelectConsecutiveOddsStepId,
            new SelectRowsSubmission([2, 3])));
    }

    // ------------------------------------------------------------ step 3b and 4

    [Test]
    public async Task FillTheGap_OneRedAfterTheThreeIsSatisfied()
    {
        await AssertOutcome<ScaffoldStepSatisfied>(Evaluate(
            ParityLadderScaffold.FillTheGapStepId,
            ScaffoldSessionTestData.FillTheGapSubmission()));
        await AssertOutcome<ScaffoldStepAccepted>(Evaluate(
            ParityLadderScaffold.FillTheGapStepId,
            new PlacePiecesSubmission([])));
        await AssertOutcome<ScaffoldStepNotSatisfied>(Evaluate(
            ParityLadderScaffold.FillTheGapStepId,
            new PlacePiecesSubmission([new PlacedPiece(1, 4, 3)])));
    }

    [Test]
    public async Task NameTheSmaller_ThreeIsSatisfiedAndFiveIsRejected()
    {
        await AssertOutcome<ScaffoldStepSatisfied>(Evaluate(
            ParityLadderScaffold.NameTheSmallerStepId,
            ScaffoldSessionTestData.NameTheSmallerSubmission()));
        await AssertOutcome<ScaffoldStepNotSatisfied>(Evaluate(
            ParityLadderScaffold.NameTheSmallerStepId,
            new SelectRowsSubmission([4])));
        await AssertOutcome<ScaffoldStepAccepted>(Evaluate(
            ParityLadderScaffold.NameTheSmallerStepId,
            new SelectRowsSubmission([])));
    }

    // ------------------------------------------------------------ steps 5 to 7

    [Test]
    public async Task JoinAndReadSum_AuthoredPartsSatisfyComposition()
    {
        await AssertOutcome<ScaffoldStepSatisfied>(Evaluate(
            ParityLadderScaffold.JoinAndReadSumStepId,
            ScaffoldSessionTestData.CorrectJoinSubmission()));
    }

    [Test]
    public async Task JoinQuantities_WrongPartCompositionIsNotSatisfied()
    {
        await AssertOutcome<ScaffoldStepNotSatisfied>(Evaluate(
            ParityLadderScaffold.JoinAndReadSumStepId,
            new JoinQuantitiesSubmission(
            [
                new SemanticQuantityReference(PracticeItemOne.N.Id),
                new SemanticQuantityReference(PracticeItemOne.ConsecutiveOddIntegers.Id)
            ])));
    }

    [Test]
    public async Task NameBarCount_TwoSatisfiesRodCountScalar()
    {
        await AssertOutcome<ScaffoldStepSatisfied>(Evaluate(
            ParityLadderScaffold.NameBarCountStepId,
            new EnterScalarSubmission(2m)));
        await AssertOutcome<ScaffoldStepNotSatisfied>(Evaluate(
            ParityLadderScaffold.NameBarCountStepId,
            new EnterScalarSubmission(3m)));
    }

    [Test]
    public async Task NameLeftoverLength_TwoSatisfiesUnitLengthScalar()
    {
        await AssertOutcome<ScaffoldStepSatisfied>(Evaluate(
            ParityLadderScaffold.NameLeftoverLengthStepId,
            new EnterScalarSubmission(2m)));
    }

    // ------------------------------------------------------------ shared vocabulary not on this path

    [Test]
    public async Task MatchEquivalentLength_TwoUnitRodsSatisfyLengthsAreEquivalent()
    {
        await AssertOutcome<ScaffoldStepSatisfied>(ScaffoldStepEvaluator.Evaluate(
            EquivalenceScaffold(),
            PracticeItemOne.Item,
            EquivalenceStepId,
            new MatchEquivalentLengthSubmission(new RodCount(2))));
        await AssertOutcome<ScaffoldStepNotSatisfied>(ScaffoldStepEvaluator.Evaluate(
            EquivalenceScaffold(),
            PracticeItemOne.Item,
            EquivalenceStepId,
            new MatchEquivalentLengthSubmission(new RodCount(1))));
    }

    [Test]
    public async Task BuildExpression_SimplifiedMathObjectSatisfiesCheck()
    {
        await AssertOutcome<ScaffoldStepSatisfied>(ScaffoldStepEvaluator.Evaluate(
            SymbolicScaffold(),
            PracticeItemOne.Item,
            ExpressionStepId,
            new BuildExpressionSubmission(PracticeItemOne.RequestedValueSimplified.MathObjectId)));
        await AssertOutcome<ScaffoldStepNotSatisfied>(ScaffoldStepEvaluator.Evaluate(
            SymbolicScaffold(),
            PracticeItemOne.Item,
            ExpressionStepId,
            new BuildExpressionSubmission(new MathObjectId("math-answer-a"))));
    }

    [Test]
    public async Task SelectAnswer_CorrectChoiceSatisfiesCheck()
    {
        await AssertOutcome<ScaffoldStepSatisfied>(ScaffoldStepEvaluator.Evaluate(
            SymbolicScaffold(),
            PracticeItemOne.Item,
            AnswerStepId,
            new SelectAnswerChoiceSubmission(PracticeItemOne.Item.CorrectAnswerId)));
        await AssertOutcome<ScaffoldStepNotSatisfied>(ScaffoldStepEvaluator.Evaluate(
            SymbolicScaffold(),
            PracticeItemOne.Item,
            AnswerStepId,
            new SelectAnswerChoiceSubmission(new AnswerChoiceId("answer-a"))));
    }

    // ------------------------------------------------------------ immutability

    [Test]
    public async Task PlacePiecesSubmission_CannotBeMutatedAfterConstruction()
    {
        var original = new PlacedPiece(2, 1, 1);
        var replacement = new PlacedPiece(1, 3, 1);
        var pieces = new List<PlacedPiece> { original };
        var submission = new PlacePiecesSubmission(pieces);

        pieces[0] = replacement;
        NotSupportedException? exception = CaptureMutationFailure(
            () => ((IList<PlacedPiece>)submission.Pieces)[0] = replacement);

        await Assert.That(submission.Pieces[0]).IsEqualTo(original);
        await Assert.That(submission.Pieces is PlacedPiece[]).IsFalse();
        await Assert.That(exception is not null).IsTrue();
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

        await Assert.That(submission.Parts[0]).IsEqualTo(original);
        await Assert.That(submission.Parts is QuantityReference[]).IsFalse();
        await Assert.That(exception is not null).IsTrue();
    }

    // ------------------------------------------------------------ contract violations

    [Test]
    public async Task Evaluate_RejectsForeignPracticeItem()
    {
        await AssertInvalid(
            "targets practice item",
            () => ScaffoldStepEvaluator.Evaluate(
                ParityLadderScaffold.Definition,
                PracticeItemTwo.Item,
                ParityLadderScaffold.JoinAndReadSumStepId,
                ScaffoldSessionTestData.CorrectJoinSubmission()));
    }

    [Test]
    public async Task Evaluate_RejectsUnknownStep()
    {
        await AssertInvalid(
            "does not exist",
            () => Evaluate(
                new ScaffoldStepId("step-unknown"),
                new EnterScalarSubmission(2m)));
    }

    [Test]
    public async Task Evaluate_RejectsSubmissionIncompatibleWithLearnerAction()
    {
        await AssertInvalid(
            "incompatible",
            () => Evaluate(
                ParityLadderScaffold.JoinAndReadSumStepId,
                new MoveRowsSubmission([2])));
        await AssertInvalid(
            "incompatible",
            () => Evaluate(
                ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
                new SelectRowsSubmission([1])));
        await AssertInvalid(
            "incompatible",
            () => Evaluate(
                ParityLadderScaffold.SortPairedEvensStepId,
                ScaffoldSessionTestData.CorrectJoinSubmission()));
    }

    [Test]
    public async Task JoinQuantities_RejectsUnknownSemanticEntityOrLatentExpression()
    {
        await AssertInvalid(
            "Semantic entity",
            () => Evaluate(
                ParityLadderScaffold.JoinAndReadSumStepId,
                new JoinQuantitiesSubmission(
                [
                    new SemanticQuantityReference(new SemanticEntityId("entity-unknown")),
                    new LatentExpressionReference(PracticeItemOne.SecondMember.Id)
                ])));
        await AssertInvalid(
            "Latent math",
            () => Evaluate(
                ParityLadderScaffold.JoinAndReadSumStepId,
                new JoinQuantitiesSubmission(
                [
                    new SemanticQuantityReference(PracticeItemOne.N.Id),
                    new LatentExpressionReference(new LatentMathId("latent-unknown"))
                ])));
    }

    // ------------------------------------------------------------ authoring validation

    [Test]
    public async Task ScaffoldCreate_RejectsGridTargetRowOutsideTheGrid()
    {
        await AssertInvalid(
            "target row outside the grid",
            () => Scaffold.Create(
                id: new ScaffoldId("scaffold-grid-row-outside"),
                practiceItem: PracticeItemOne.Item,
                resources: ParityLadderScaffold.Definition.Resources,
                steps:
                [
                    new ScaffoldStep(
                        Id: new ScaffoldStepId("step"),
                        Purpose: ScaffoldPhasePurpose.ConceptFormation,
                        Prompt: new ScaffoldPrompt("Build.", []),
                        Scene: new GridScene(8, 4, [new GridPiece(PieceKind.Rod, 3, 1, 1)], [new GridRow(1, 6, 3)]),
                        Action: new PlacePieces([2, 1]),
                        SuccessCheck: new MatchesRowCompositions(2))
                ]));
    }

    [Test]
    public async Task ScaffoldCreate_RejectsPlacingWithoutTargetRows()
    {
        await AssertInvalid(
            "no target rows",
            () => Scaffold.Create(
                id: new ScaffoldId("scaffold-grid-no-targets"),
                practiceItem: PracticeItemOne.Item,
                resources: ParityLadderScaffold.Definition.Resources,
                steps:
                [
                    new ScaffoldStep(
                        Id: new ScaffoldStepId("step"),
                        Purpose: ScaffoldPhasePurpose.ConceptFormation,
                        Prompt: new ScaffoldPrompt("Build.", []),
                        Scene: new GridScene(8, 4, [new GridPiece(PieceKind.Rod, 3, 1, 1)], []),
                        Action: new PlacePieces([2, 1]),
                        SuccessCheck: new MatchesRowCompositions(2))
                ]));
    }

    [Test]
    public async Task ScaffoldCreate_RejectsExpectedMovedRowWithNothingOnIt()
    {
        await AssertInvalid(
            "nothing is on it",
            () => Scaffold.Create(
                id: new ScaffoldId("scaffold-grid-move-empty"),
                practiceItem: PracticeItemOne.Item,
                resources: ParityLadderScaffold.Definition.Resources,
                steps:
                [
                    new ScaffoldStep(
                        Id: new ScaffoldStepId("step"),
                        Purpose: ScaffoldPhasePurpose.ConceptFormation,
                        Prompt: new ScaffoldPrompt("Sort.", []),
                        Scene: new GridScene(20, 4, [new GridPiece(PieceKind.Rod, 2, 1, 1)], []),
                        Action: new MoveRows(10),
                        SuccessCheck: new MatchesRowPartition([1, 2]))
                ]));
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
                        Lengths: [new UnitLength(1), new UnitLength(2), new UnitLength(3)])
                ],
                steps:
                [
                    new ScaffoldStep(
                        Id: new ScaffoldStepId("step"),
                        Purpose: ScaffoldPhasePurpose.ConceptFormation,
                        Prompt: new ScaffoldPrompt("Classify.", []),
                        Scene: new RodMeasurementScene(
                            ProbeRodId: new ScaffoldResourceId("resource-probe"),
                            SpanSeriesId: new ScaffoldResourceId("resource-spans")),
                        Action: new ClassifyByFit(),
                        SuccessCheck: new MatchesComputedFit())
                ]));
    }

    [Test]
    public async Task ScaffoldCreate_RejectsEvaluatorActionWithIncompatibleScene()
    {
        await AssertInvalid(
            "must use a RodEquivalenceScene",
            () => Scaffold.Create(
                id: new ScaffoldId("scaffold-action-scene-mismatch"),
                practiceItem: PracticeItemOne.Item,
                resources: ParityLadderScaffold.Definition.Resources,
                steps:
                [
                    new ScaffoldStep(
                        Id: new ScaffoldStepId("step"),
                        Purpose: ScaffoldPhasePurpose.ConceptFormation,
                        Prompt: new ScaffoldPrompt("Match rods.", []),
                        Scene: new AnswerChoiceScene(),
                        Action: new MatchEquivalentLength(),
                        SuccessCheck: new LengthsAreEquivalent())
                ]));
    }

    [Test]
    public async Task ScaffoldCreate_RejectsDuplicateStepIds()
    {
        ScaffoldStep step = ParityLadderScaffold.Definition.FloorStep;

        await AssertInvalid(
            "Duplicate scaffold step",
            () => Scaffold.Create(
                id: new ScaffoldId("scaffold-duplicate-step"),
                practiceItem: PracticeItemOne.Item,
                resources: ParityLadderScaffold.Definition.Resources,
                steps: [step, step]));
    }

    [Test]
    public async Task EvaluationOutcome_DoesNotExposeExpectedValueOrCorrectAnswer()
    {
        ScaffoldStepEvaluation[] outcomes =
        [
            new ScaffoldStepSatisfied(),
            new ScaffoldStepAccepted(),
            new ScaffoldStepNotSatisfied()
        ];

        string json = JsonSerializer.Serialize(outcomes);

        await Assert.That(json).DoesNotContain("Expected");
        await Assert.That(json).DoesNotContain("CorrectAnswer");
        await Assert.That(json).DoesNotContain("AnswerChoice");
        await Assert.That(json).DoesNotContain("Latent");
        await Assert.That(json).DoesNotContain("Value");
    }

    // ------------------------------------------------------------ helpers

    private static readonly ScaffoldStepId EquivalenceStepId = new("step-equivalence");
    private static readonly ScaffoldStepId ExpressionStepId = new("step-expression");
    private static readonly ScaffoldStepId AnswerStepId = new("step-answer");

    private static Scaffold EquivalenceScaffold() =>
        Scaffold.Create(
            id: new ScaffoldId("scaffold-equivalence"),
            practiceItem: PracticeItemOne.Item,
            resources: ParityLadderScaffold.Definition.Resources,
            steps:
            [
                new ScaffoldStep(
                    Id: EquivalenceStepId,
                    Purpose: ScaffoldPhasePurpose.ConceptFormation,
                    Prompt: new ScaffoldPrompt("Match rods.", []),
                    Scene: new RodEquivalenceScene(
                        UnitRodId: ParityLadderScaffold.UnitRodId,
                        ProbeRodId: ParityLadderScaffold.OddStepRodId),
                    Action: new MatchEquivalentLength(),
                    SuccessCheck: new LengthsAreEquivalent())
            ]);

    private static Scaffold SymbolicScaffold() =>
        Scaffold.Create(
            id: new ScaffoldId("scaffold-symbolic"),
            practiceItem: PracticeItemOne.Item,
            resources: ParityLadderScaffold.Definition.Resources,
            steps:
            [
                new ScaffoldStep(
                    Id: ExpressionStepId,
                    Purpose: ScaffoldPhasePurpose.Generalization,
                    Prompt: new ScaffoldPrompt("Write the sum.", []),
                    Scene: new AnswerChoiceScene(),
                    Action: new BuildExpression(),
                    SuccessCheck: new MatchesLatentExpression(
                        PracticeItemOne.RequestedValueSimplified.Id)),
                new ScaffoldStep(
                    Id: AnswerStepId,
                    Purpose: ScaffoldPhasePurpose.Verification,
                    Prompt: new ScaffoldPrompt("Select the answer.", []),
                    Scene: new AnswerChoiceScene(),
                    Action: new SelectAnswerChoice(),
                    SuccessCheck: new MatchesCorrectAnswer())
            ]);

    private static PlacedPiece ToPlaced(GridPiece piece) =>
        new(piece.Length, piece.X, piece.Y);

    private static ScaffoldStepEvaluation Evaluate(
        ScaffoldStepId stepId,
        ScaffoldStepSubmission submission) =>
        ScaffoldStepEvaluator.Evaluate(
            ParityLadderScaffold.Definition,
            PracticeItemOne.Item,
            stepId,
            submission);

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

    private static async Task AssertOutcome<TOutcome>(ScaffoldStepEvaluation evaluation)
    {
        await Assert.That(evaluation.Value).IsTypeOf<TOutcome>();
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
