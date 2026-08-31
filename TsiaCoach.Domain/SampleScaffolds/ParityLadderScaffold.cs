using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.SampleScaffolds;

public static class ParityLadderScaffold
{
    public static readonly ScaffoldResourceId UnitRodId = new("resource-unit-rod");
    public static readonly ScaffoldResourceId OddStepRodId = new("resource-odd-step-rod");
    public static readonly ScaffoldResourceId MeasurandSeriesId = new("resource-measurand-series");

    public static readonly ScaffoldStepId EstablishRodLengthStepId =
        new("step-establish-red-length");
    public static readonly ScaffoldStepId ClassifyLengthsStepId =
        new("step-classify-lengths");
    public static readonly ScaffoldStepId NameOddClassStepId =
        new("step-name-odd-class");
    public static readonly ScaffoldStepId TraverseOddGapsStepId =
        new("step-traverse-odd-gaps");
    public static readonly ScaffoldStepId StateOddStepLengthStepId =
        new("step-state-odd-step-length");
    public static readonly ScaffoldStepId JoinKnownQuantitiesStepId =
        new("step-join-known-quantities");
    public static readonly ScaffoldStepId CountBasePartsStepId =
        new("step-count-base-parts");
    public static readonly ScaffoldStepId MeasureRemainderStepId =
        new("step-measure-remainder");
    public static readonly ScaffoldStepId JoinUnknownQuantitiesStepId =
        new("step-join-unknown-quantities");
    public static readonly ScaffoldStepId ComposeExpressionStepId =
        new("step-compose-expression");
    public static readonly ScaffoldStepId SimplifyExpressionStepId =
        new("step-simplify-expression");
    public static readonly ScaffoldStepId SelectAnswerStepId =
        new("step-select-answer");

    public static readonly Scaffold Definition = Scaffold.Create(
        id: new("scaffold-parity-ladder"),
        practiceItem: PracticeItemOne.Item,
        resources:
        [
            new RodResource(
                Id: UnitRodId,
                Length: new LiteralLength(new(1)),
                Multiplicity: ResourceMultiplicity.Repeatable,
                Role: RodRole.Unit),
            new RodResource(
                Id: OddStepRodId,
                Length: new LatentLengthReference(PracticeItemOne.OrderedStep.Id),
                Multiplicity: ResourceMultiplicity.Singleton,
                Role: RodRole.ProbeAndStep),
            new RodSeriesResource(
                Id: MeasurandSeriesId,
                Lengths:
                [
                    new(1),
                    new(2),
                    new(3),
                    new(4),
                    new(5),
                    new(6),
                    new(7),
                    new(8),
                    new(9),
                    new(10)
                ])
        ],
        phases:
        [
            new ScaffoldPhase(
                Id: new("phase-parity-foundation"),
                Purpose: ScaffoldPhasePurpose.ConceptFormation,
                Steps:
                [
                    new ScaffoldStep(
                        Id: EstablishRodLengthStepId,
                        Prompt: new(
                            Text: "Use white rods to match the length of the red rod.",
                            FocusPhraseIds: []),
                        Scene: new FreshScene(
                            new RodEquivalenceScene(
                                UnitRodId: UnitRodId,
                                ProbeRodId: OddStepRodId)),
                        Action: new MatchEquivalentLength(),
                        SuccessCheck: new LengthsAreEquivalent()),
                    new ScaffoldStep(
                        Id: ClassifyLengthsStepId,
                        Prompt: new(
                            Text: "Use the red rod to find which lengths finish exactly and which leave one white unit.",
                            FocusPhraseIds: []),
                        Scene: new FreshScene(
                            new RodMeasurementScene(
                                ProbeRodId: OddStepRodId,
                                SpanSeriesId: MeasurandSeriesId)),
                        Action: new ClassifyByFit(),
                        SuccessCheck: new MatchesComputedFit()),
                    new ScaffoldStep(
                        Id: NameOddClassStepId,
                        Prompt: new(
                            Text: "The lengths with one white unit left over are called odd. Select that group.",
                            FocusPhraseIds:
                            [
                                new("phrase-set-declaration")
                            ]),
                        Scene: new ContinuedScene(
                            SourceStepId: ClassifyLengthsStepId,
                            Access: SceneAccess.Interactive),
                        Action: new NameFitClassification(
                            FitClassification.OneUnitLeftover),
                        SuccessCheck: new MatchesIntegerDomain(
                            Classification: FitClassification.OneUnitLeftover,
                            Domain: IntegerDomain.OddIntegers))
                ]),
            new ScaffoldPhase(
                Id: new("phase-consecutive-odd-step"),
                Purpose: ScaffoldPhasePurpose.LanguageInterpretation,
                Steps:
                [
                    new ScaffoldStep(
                        Id: TraverseOddGapsStepId,
                        Prompt: new(
                            Text: "Use the same red rod to move from each odd length to the next odd length.",
                            FocusPhraseIds:
                            [
                                new("phrase-ordered-step")
                            ]),
                        Scene: new FreshScene(
                            new RodGapScene(
                                StepRodId: OddStepRodId,
                                ClassificationStepId: ClassifyLengthsStepId,
                                IncludedOutcome: FitClassification.OneUnitLeftover)),
                        Action: new TraverseAllGaps(),
                        SuccessCheck: new AllGapsTraversed(OddStepRodId)),
                    new ScaffoldStep(
                        Id: StateOddStepLengthStepId,
                        Prompt: new(
                            Text: "How many units long is the step from one odd integer to the next?",
                            FocusPhraseIds:
                            [
                                new("phrase-ordered-step")
                            ]),
                        Scene: new ContinuedScene(
                            SourceStepId: TraverseOddGapsStepId,
                            Access: SceneAccess.Frozen),
                        Action: new EnterScalar(ScalarReading.UnitLength),
                        SuccessCheck: new MatchesLatentScalar(
                            ExpectedValueId: PracticeItemOne.OrderedStep.Id,
                            Reading: ScalarReading.UnitLength))
                ]),
            new ScaffoldPhase(
                Id: new("phase-known-comparison-and-join"),
                Purpose: ScaffoldPhasePurpose.Representation,
                Steps:
                [
                    new ScaffoldStep(
                        Id: JoinKnownQuantitiesStepId,
                        Prompt: new(
                            Text: "Let the first odd integer be 15. Build the next odd integer, then join both parts in the sum lane.",
                            FocusPhraseIds:
                            [
                                new("phrase-selector"),
                                new("phrase-target")
                            ]),
                        Scene: new FreshScene(
                            new QuantityJoinScene(
                                Parts:
                                [
                                    new SemanticQuantityReference(PracticeItemOne.N.Id),
                                    new LatentExpressionReference(PracticeItemOne.SecondMember.Id)
                                ],
                                Bindings:
                                [
                                    new(
                                        SemanticEntityId: PracticeItemOne.N.Id,
                                        Value: new(15))
                                ],
                                ShowSizedTarget: true)),
                        Action: new JoinQuantities(),
                        SuccessCheck: new MatchesPartComposition()),
                    new ScaffoldStep(
                        Id: CountBasePartsStepId,
                        Prompt: new(
                            Text: "How many 15-unit parts are in the joined train?",
                            FocusPhraseIds:
                            [
                                new("phrase-target")
                            ]),
                        Scene: new ContinuedScene(
                            SourceStepId: JoinKnownQuantitiesStepId,
                            Access: SceneAccess.Frozen),
                        Action: new EnterScalar(ScalarReading.RodCount),
                        SuccessCheck: new MatchesLatentScalar(
                            ExpectedValueId: PracticeItemOne.LikeTermCount.Id,
                            Reading: ScalarReading.RodCount)),
                    new ScaffoldStep(
                        Id: MeasureRemainderStepId,
                        Prompt: new(
                            Text: "How many units long is the piece left after the two equal parts?",
                            FocusPhraseIds:
                            [
                                new("phrase-ordered-step")
                            ]),
                        Scene: new ContinuedScene(
                            SourceStepId: CountBasePartsStepId,
                            Access: SceneAccess.Frozen),
                        Action: new EnterScalar(ScalarReading.UnitLength),
                        SuccessCheck: new MatchesLatentScalar(
                            ExpectedValueId: PracticeItemOne.OrderedStep.Id,
                            Reading: ScalarReading.UnitLength))
                ]),
            new ScaffoldPhase(
                Id: new("phase-symbolic-generalization"),
                Purpose: ScaffoldPhasePurpose.Generalization,
                Steps:
                [
                    new ScaffoldStep(
                        Id: JoinUnknownQuantitiesStepId,
                        Prompt: new(
                            Text: "Now let the first odd integer be n. Build and join the same two-part structure without a sized target.",
                            FocusPhraseIds:
                            [
                                new("phrase-selector"),
                                new("phrase-target")
                            ]),
                        Scene: new FreshScene(
                            new QuantityJoinScene(
                                Parts:
                                [
                                    new SemanticQuantityReference(PracticeItemOne.N.Id),
                                    new LatentExpressionReference(PracticeItemOne.SecondMember.Id)
                                ],
                                Bindings: [],
                                ShowSizedTarget: false)),
                        Action: new JoinQuantities(),
                        SuccessCheck: new MatchesPartComposition()),
                    new ScaffoldStep(
                        Id: ComposeExpressionStepId,
                        Prompt: new(
                            Text: "Write the sum shown by the joined parts before combining like terms.",
                            FocusPhraseIds:
                            [
                                new("phrase-target")
                            ]),
                        Scene: new ContinuedScene(
                            SourceStepId: JoinUnknownQuantitiesStepId,
                            Access: SceneAccess.Frozen),
                        Action: new BuildExpression(),
                        SuccessCheck: new MatchesLatentExpression(
                            PracticeItemOne.RequestedValueComposed.Id)),
                    new ScaffoldStep(
                        Id: SimplifyExpressionStepId,
                        Prompt: new(
                            Text: "Combine the two n-parts and keep the 2-unit step.",
                            FocusPhraseIds:
                            [
                                new("phrase-target")
                            ]),
                        Scene: new ContinuedScene(
                            SourceStepId: ComposeExpressionStepId,
                            Access: SceneAccess.Frozen),
                        Action: new BuildExpression(),
                        SuccessCheck: new MatchesLatentExpression(
                            PracticeItemOne.RequestedValueSimplified.Id))
                ]),
            new ScaffoldPhase(
                Id: new("phase-answer-verification"),
                Purpose: ScaffoldPhasePurpose.Verification,
                Steps:
                [
                    new ScaffoldStep(
                        Id: SelectAnswerStepId,
                        Prompt: new(
                            Text: "Select the answer choice that matches the expression you built.",
                            FocusPhraseIds:
                            [
                                new("phrase-answer-format")
                            ]),
                        Scene: new FreshScene(new AnswerChoiceScene()),
                        Action: new SelectAnswerChoice(),
                        SuccessCheck: new MatchesCorrectAnswer())
                ])
        ]);
}
