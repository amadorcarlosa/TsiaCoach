using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.SampleScaffolds;

/// <summary>
/// The latent math of practice item one written out as one flat path.
/// "n is the least of two consecutive odd integers; find the sum" compresses:
/// what odd means, why consecutive odds differ by two, that sum means join,
/// and that the 2 in 2n counts bars while the 2 in "+ 2" is a length.
/// Every step renders from resources alone, so any step is an entry point.
/// </summary>
public static class ParityLadderScaffold
{
    public static readonly ScaffoldResourceId UnitRodId = new("resource-unit-rod");
    public static readonly ScaffoldResourceId OddStepRodId = new("resource-odd-step-rod");
    public static readonly ScaffoldResourceId MeasurandSeriesId = new("resource-measurand-series");

    /// <summary>Floor: what makes a number odd, shown by rebuilding 1 to 10 from twos and ones.</summary>
    public static readonly ScaffoldStepId RebuildFromTwosAndOnesStepId =
        new("step-rebuild-from-twos-and-ones");

    /// <summary>Remove every fully paired length; what survives is named odd.</summary>
    public static readonly ScaffoldStepId RemovePairedEvensStepId =
        new("step-remove-paired-evens");

    /// <summary>The gap from one odd to the next is one full two: n and n + 2.</summary>
    public static readonly ScaffoldStepId SelectConsecutiveOddsStepId =
        new("step-select-consecutive-odds");

    /// <summary>Sum means join: n and n + 2 end to end in the sum lane.</summary>
    public static readonly ScaffoldStepId JoinAndReadSumStepId =
        new("step-join-and-read-sum");

    /// <summary>The 2 in 2n is a count of n-bars.</summary>
    public static readonly ScaffoldStepId NameBarCountStepId =
        new("step-name-bar-count");

    /// <summary>The 2 in "+ 2" is a length left after the bars.</summary>
    public static readonly ScaffoldStepId NameLeftoverLengthStepId =
        new("step-name-leftover-length");

    private static readonly QuantityJoinScene SumScene = new(
        Parts:
        [
            new SemanticQuantityReference(PracticeItemOne.N.Id),
            new LatentExpressionReference(PracticeItemOne.SecondMember.Id)
        ],
        Bindings: [],
        ShowSizedTarget: false);

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
        steps:
        [
            new ScaffoldStep(
                Id: RebuildFromTwosAndOnesStepId,
                Purpose: ScaffoldPhasePurpose.ConceptFormation,
                Prompt: new(
                    Text: "Rebuild each length from 1 to 10 using only twos and ones. Mark every length that ends with a single one.",
                    FocusPhraseIds:
                    [
                        new("phrase-set-declaration")
                    ]),
                Scene: new RodMeasurementScene(
                    ProbeRodId: OddStepRodId,
                    SpanSeriesId: MeasurandSeriesId),
                Action: new ClassifyByFit(),
                SuccessCheck: new MatchesComputedFit()),
            new ScaffoldStep(
                Id: RemovePairedEvensStepId,
                Purpose: ScaffoldPhasePurpose.ConceptFormation,
                Prompt: new(
                    Text: "Remove every length made only of twos. The lengths that survive each keep one leftover unit. Name that group.",
                    FocusPhraseIds:
                    [
                        new("phrase-set-declaration")
                    ]),
                Scene: new RodMeasurementScene(
                    ProbeRodId: OddStepRodId,
                    SpanSeriesId: MeasurandSeriesId),
                Action: new NameFitClassification(
                    FitClassification.OneUnitLeftover),
                SuccessCheck: new MatchesIntegerDomain(
                    Classification: FitClassification.OneUnitLeftover,
                    Domain: IntegerDomain.OddIntegers)),
            new ScaffoldStep(
                Id: SelectConsecutiveOddsStepId,
                Purpose: ScaffoldPhasePurpose.LanguageInterpretation,
                Prompt: new(
                    Text: "Move from each odd length to the next odd length with the two-rod. The gap between consecutive odds is one full two.",
                    FocusPhraseIds:
                    [
                        new("phrase-ordered-step")
                    ]),
                Scene: new RodGapScene(
                    StepRodId: OddStepRodId,
                    SpanSeriesId: MeasurandSeriesId,
                    IncludedOutcome: FitClassification.OneUnitLeftover),
                Action: new TraverseAllGaps(),
                SuccessCheck: new AllGapsTraversed(OddStepRodId)),
            new ScaffoldStep(
                Id: JoinAndReadSumStepId,
                Purpose: ScaffoldPhasePurpose.Representation,
                Prompt: new(
                    Text: "Let n be the first odd integer. Join n and the next odd integer end to end in the sum lane, then read the total.",
                    FocusPhraseIds:
                    [
                        new("phrase-selector"),
                        new("phrase-target")
                    ]),
                Scene: SumScene,
                Action: new JoinQuantities(),
                SuccessCheck: new MatchesPartComposition()),
            new ScaffoldStep(
                Id: NameBarCountStepId,
                Purpose: ScaffoldPhasePurpose.Generalization,
                Prompt: new(
                    Text: "How many n-bars are in the joined train? That count is the 2 in 2n.",
                    FocusPhraseIds:
                    [
                        new("phrase-target")
                    ]),
                Scene: SumScene,
                Action: new EnterScalar(ScalarReading.RodCount),
                SuccessCheck: new MatchesLatentScalar(
                    ExpectedValueId: PracticeItemOne.LikeTermCount.Id,
                    Reading: ScalarReading.RodCount)),
            new ScaffoldStep(
                Id: NameLeftoverLengthStepId,
                Purpose: ScaffoldPhasePurpose.Generalization,
                Prompt: new(
                    Text: "How many units long is the piece left after the two n-bars? That length is the 2 in + 2.",
                    FocusPhraseIds:
                    [
                        new("phrase-ordered-step")
                    ]),
                Scene: SumScene,
                Action: new EnterScalar(ScalarReading.UnitLength),
                SuccessCheck: new MatchesLatentScalar(
                    ExpectedValueId: PracticeItemOne.OrderedStep.Id,
                    Reading: ScalarReading.UnitLength))
        ]);
}
