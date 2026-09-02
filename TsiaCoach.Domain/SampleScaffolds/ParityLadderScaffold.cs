using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.SampleScaffolds;

/// <summary>
/// The latent math of practice item one written out as one flat path, as
/// authored in docs/scaffolds/parity-ladder-path.md.
///
/// "n is the least of two consecutive odd integers; find the sum" compresses:
/// what odd means, why consecutive odds differ by two, that sum means join,
/// and that the 2 in 2n counts bars while the 2 in "+ 2" is a length.
/// Every step renders from its own scene, so any step is an entry point.
/// Steps marked entry-only are landings for a routed student and are skipped
/// in ordinary progress.
/// </summary>
public static class ParityLadderScaffold
{
    public static readonly ScaffoldResourceId UnitRodId = new("resource-unit-rod");
    public static readonly ScaffoldResourceId OddStepRodId = new("resource-odd-step-rod");
    public static readonly ScaffoldResourceId MeasurandSeriesId = new("resource-measurand-series");

    /// <summary>Floor: what makes a number odd, by rebuilding 1 to 10 from twos and ones.</summary>
    public static readonly ScaffoldStepId RebuildFromTwosAndOnesStepId =
        new("step-rebuild-from-twos-and-ones");

    /// <summary>Landing for "a true pattern that is not the target": 8 and 9 rebuilt side by side.</summary>
    public static readonly ScaffoldStepId ContrastPairStepId =
        new("step-contrast-pair");

    /// <summary>Landing for "no pattern seen": click every rod that ends with a white.</summary>
    public static readonly ScaffoldStepId MarkTheWhitesStepId =
        new("step-mark-the-whites");

    /// <summary>Sort the red-only rows to the compare column; the survivors are named odd.</summary>
    public static readonly ScaffoldStepId SortPairedEvensStepId =
        new("step-sort-paired-evens");

    /// <summary>Click two odd rows that are neighbours: the item's "consecutive".</summary>
    public static readonly ScaffoldStepId SelectConsecutiveOddsStepId =
        new("step-select-consecutive-odds");

    /// <summary>Make the 3 as long as the 5: one red fills the gap.</summary>
    public static readonly ScaffoldStepId FillTheGapStepId =
        new("step-fill-the-gap");

    /// <summary>Click the smaller one: that one is n.</summary>
    public static readonly ScaffoldStepId NameTheSmallerStepId =
        new("step-name-the-smaller");

    /// <summary>Sum means join: n and n + 2 end to end in the sum lane.</summary>
    public static readonly ScaffoldStepId JoinAndReadSumStepId =
        new("step-join-and-read-sum");

    /// <summary>The 2 in 2n is a count of n-bars.</summary>
    public static readonly ScaffoldStepId NameBarCountStepId =
        new("step-name-bar-count");

    /// <summary>The 2 in "+ 2" is a length left after the bars.</summary>
    public static readonly ScaffoldStepId NameLeftoverLengthStepId =
        new("step-name-leftover-length");

    private const int GridCols = 36;
    private const int GridRows = 12;

    /// <summary>Rod n on row n, left edge at column 1.</summary>
    private static readonly IReadOnlyList<GridPiece> Staircase =
        Enumerable.Range(1, 10)
            .Select(n => new GridPiece(PieceKind.Rod, n, 1, n))
            .ToArray();

    private static readonly IReadOnlyList<GridRow> StaircaseRows =
        Enumerable.Range(1, 10)
            .Select(n => new GridRow(Y: n, Start: 1, Length: n))
            .ToArray();

    /// <summary>Every length 1 to 10 as floor(n / 2) reds then n mod 2 whites, from column 1.</summary>
    private static readonly IReadOnlyList<GridPiece> TwosAndOnes =
        Enumerable.Range(1, 10)
            .SelectMany(n => Composition(n, startX: 1, y: n))
            .ToArray();

    /// <summary>Only the odd rows of <see cref="TwosAndOnes"/>.</summary>
    private static readonly IReadOnlyList<GridPiece> OddTwosAndOnes =
        TwosAndOnes.Where(piece => piece.Y % 2 == 1).ToArray();

    private static readonly IReadOnlyList<int> OddRows = [1, 3, 5, 7, 9];
    private static readonly IReadOnlyList<int> EvenRows = [2, 4, 6, 8, 10];

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
                Lengths: Enumerable.Range(1, 10).Select(n => new UnitLength(n)).ToArray())
        ],
        steps:
        [
            // 1. Floor.
            new ScaffoldStep(
                Id: RebuildFromTwosAndOnesStepId,
                Purpose: ScaffoldPhasePurpose.ConceptFormation,
                Prompt: new(
                    Text: "Build every rod out of twos and ones. Drag red twos and white ones on top of each rod, from 1 to 10, until it is covered exactly. Rule: put down as many twos as will fit. Only use a white one when a two won't fit.",
                    FocusPhraseIds: [new("phrase-set-declaration")]),
                Scene: new GridScene(GridCols, GridRows, Staircase, StaircaseRows),
                Action: new PlacePieces(AllowedLengths: [2, 1]),
                SuccessCheck: new MatchesRowCompositions(StepLength: 2)),

            // 1b. Landing for a true-but-other pattern: 8 and 9 side by side.
            new ScaffoldStep(
                Id: ContrastPairStepId,
                Purpose: ScaffoldPhasePurpose.ConceptFormation,
                Prompt: new(
                    Text: "Fill the empty rows with twos and ones. As many twos as will fit.",
                    FocusPhraseIds: [new("phrase-set-declaration")]),
                Scene: new GridScene(
                    Cols: 16,
                    Rows: 6,
                    Reference:
                    [
                        new GridPiece(PieceKind.Rod, 8, 1, 1),
                        new GridPiece(PieceKind.Rod, 9, 1, 3)
                    ],
                    TargetRows:
                    [
                        new GridRow(Y: 2, Start: 1, Length: 8),
                        new GridRow(Y: 4, Start: 1, Length: 9)
                    ]),
                Action: new PlacePieces(AllowedLengths: [2, 1]),
                SuccessCheck: new MatchesRowCompositions(StepLength: 2),
                EntryOnly: true),

            // 1c. Landing for no pattern seen: click every rod that ends with a white.
            new ScaffoldStep(
                Id: MarkTheWhitesStepId,
                Purpose: ScaffoldPhasePurpose.ConceptFormation,
                Prompt: new(
                    Text: "Click every rod that ends with a white one.",
                    FocusPhraseIds: [new("phrase-set-declaration")]),
                Scene: new GridScene(GridCols, GridRows, TwosAndOnes, TargetRows: []),
                Action: new SelectRows(),
                SuccessCheck: new MatchesRowSelection(
                    SelectableRows: Enumerable.Range(1, 10).ToArray(),
                    RequiredCount: 5,
                    Rule: SelectionRule.ExactSet,
                    ExpectedRows: OddRows),
                EntryOnly: true),

            // 2. Sort. Nothing is removed.
            new ScaffoldStep(
                Id: SortPairedEvensStepId,
                Purpose: ScaffoldPhasePurpose.ConceptFormation,
                Prompt: new(
                    Text: "Click every row that is made only of reds. It will move to the right so you can compare.",
                    FocusPhraseIds: [new("phrase-set-declaration")]),
                Scene: new GridScene(GridCols, GridRows, TwosAndOnes, TargetRows: []),
                Action: new MoveRows(CompareColumn: 12),
                SuccessCheck: new MatchesRowPartition(ExpectedMovedRows: EvenRows)),

            // 3. Consecutive: two odd rows that are neighbours.
            new ScaffoldStep(
                Id: SelectConsecutiveOddsStepId,
                Purpose: ScaffoldPhasePurpose.LanguageInterpretation,
                Prompt: new(
                    Text: "Click two consecutive odd numbers: two that are next to each other in this list.",
                    FocusPhraseIds: [new("phrase-ordered-step")]),
                Scene: new GridScene(GridCols, GridRows, OddTwosAndOnes, TargetRows: []),
                Action: new SelectRows(),
                SuccessCheck: new MatchesRowSelection(
                    SelectableRows: OddRows,
                    RequiredCount: 2,
                    Rule: SelectionRule.AdjacentInList,
                    ExpectedRows: [])),

            // 3b. Fill the gap: the 3 becomes as long as the 5. Pair fixed at 3 and 5 in this version.
            new ScaffoldStep(
                Id: FillTheGapStepId,
                Purpose: ScaffoldPhasePurpose.LanguageInterpretation,
                Prompt: new(
                    Text: "Take 3 and 5, two consecutive odd numbers. Make the 3 as long as the 5.",
                    FocusPhraseIds: [new("phrase-ordered-step")]),
                Scene: new GridScene(
                    Cols: 16,
                    Rows: 6,
                    Reference:
                    [
                        .. Composition(3, startX: 1, y: 1),
                        .. Composition(5, startX: 1, y: 2),
                        new GridPiece(PieceKind.Rod, 3, 1, 3),
                        new GridPiece(PieceKind.Rod, 5, 1, 4)
                    ],
                    TargetRows: [new GridRow(Y: 3, Start: 4, Length: 2)]),
                Action: new PlacePieces(AllowedLengths: [2, 1]),
                SuccessCheck: new MatchesRowCompositions(StepLength: 2)),

            // 4. The smaller one is n.
            new ScaffoldStep(
                Id: NameTheSmallerStepId,
                Purpose: ScaffoldPhasePurpose.Representation,
                Prompt: new(
                    Text: "Click the smaller one. That one is n.",
                    FocusPhraseIds: [new("phrase-selector")]),
                Scene: new GridScene(
                    Cols: 16,
                    Rows: 6,
                    Reference:
                    [
                        .. Composition(3, startX: 1, y: 1),
                        .. Composition(5, startX: 1, y: 2),
                        new GridPiece(PieceKind.Rod, 3, 1, 3),
                        new GridPiece(PieceKind.Rod, 5, 1, 4)
                    ],
                    TargetRows: []),
                Action: new SelectRows(),
                SuccessCheck: new MatchesRowSelection(
                    SelectableRows: [3, 4],
                    RequiredCount: 1,
                    Rule: SelectionRule.ExactSet,
                    ExpectedRows: [3])),

            // 5. Sum means join.
            new ScaffoldStep(
                Id: JoinAndReadSumStepId,
                Purpose: ScaffoldPhasePurpose.Representation,
                Prompt: new(
                    Text: "The smaller odd number is n. The next odd number is n + 2. Join n and n + 2 end to end in the sum lane, then read the total.",
                    FocusPhraseIds:
                    [
                        new("phrase-selector"),
                        new("phrase-target")
                    ]),
                Scene: SumScene,
                Action: new JoinQuantities(),
                SuccessCheck: new MatchesPartComposition()),

            // 6. The 2 in 2n counts bars.
            new ScaffoldStep(
                Id: NameBarCountStepId,
                Purpose: ScaffoldPhasePurpose.Generalization,
                Prompt: new(
                    Text: "How many n-bars are in the joined train? That count is the 2 in 2n.",
                    FocusPhraseIds: [new("phrase-target")]),
                Scene: SumScene,
                Action: new EnterScalar(ScalarReading.RodCount),
                SuccessCheck: new MatchesLatentScalar(
                    ExpectedValueId: PracticeItemOne.LikeTermCount.Id,
                    Reading: ScalarReading.RodCount)),

            // 7. The 2 in + 2 is a length.
            new ScaffoldStep(
                Id: NameLeftoverLengthStepId,
                Purpose: ScaffoldPhasePurpose.Generalization,
                Prompt: new(
                    Text: "How many units long is the piece left after the two n-bars? That length is the 2 in + 2.",
                    FocusPhraseIds: [new("phrase-ordered-step")]),
                Scene: SumScene,
                Action: new EnterScalar(ScalarReading.UnitLength),
                SuccessCheck: new MatchesLatentScalar(
                    ExpectedValueId: PracticeItemOne.OrderedStep.Id,
                    Reading: ScalarReading.UnitLength))
        ]);

    /// <summary>floor(n / 2) reds then n mod 2 whites, laid end to end from <paramref name="startX"/> on row <paramref name="y"/>.</summary>
    public static IReadOnlyList<GridPiece> Composition(int n, int startX, int y)
    {
        var pieces = new List<GridPiece>();
        int x = startX;
        for (int k = 0; k < n / 2; k++)
        {
            pieces.Add(new GridPiece(PieceKind.Rod, 2, x, y));
            x += 2;
        }

        if (n % 2 == 1)
        {
            pieces.Add(new GridPiece(PieceKind.Rod, 1, x, y));
        }

        return pieces;
    }
}
