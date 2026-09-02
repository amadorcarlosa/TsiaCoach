using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Scaffolds;

public sealed record MatchEquivalentLength;
public sealed record ClassifyByFit;
public sealed record NameFitClassification(FitClassification Classification);
public sealed record TraverseAllGaps;
public sealed record JoinQuantities;
public sealed record EnterScalar(ScalarReading Reading);
public sealed record BuildExpression;
public sealed record SelectAnswerChoice;

/// <summary>
/// Drop rods of the allowed lengths onto the scene's target rows. Every drop
/// is checked; the whole build is submitted each time.
/// </summary>
public sealed record PlacePieces(
    IReadOnlyList<int> AllowedLengths
);

/// <summary>
/// Click a reference row to move its whole train to <see cref="CompareColumn"/>,
/// and click again to bring it back. The set of moved rows is submitted.
/// </summary>
public sealed record MoveRows(
    int CompareColumn
);

/// <summary>Click reference rows to select them. The selected set is submitted.</summary>
public sealed record SelectRows;

public union LearnerAction(
    MatchEquivalentLength,
    ClassifyByFit,
    NameFitClassification,
    TraverseAllGaps,
    JoinQuantities,
    EnterScalar,
    BuildExpression,
    SelectAnswerChoice,
    PlacePieces,
    MoveRows,
    SelectRows
);

public sealed record LengthsAreEquivalent;
public sealed record MatchesComputedFit;
public sealed record MatchesIntegerDomain(
    FitClassification Classification,
    IntegerDomain Domain
);
public sealed record AllGapsTraversed(
    ScaffoldResourceId RequiredResourceId
);
public sealed record MatchesPartComposition;
public sealed record MatchesLatentScalar(
    LatentMathId ExpectedValueId,
    ScalarReading Reading
);
public sealed record MatchesLatentExpression(
    LatentMathId ExpectedExpressionId
);
public sealed record MatchesCorrectAnswer;

/// <summary>
/// Every target row must be covered exactly by rods of <see cref="StepLength"/>
/// plus at most one rod of length 1, using as many step-length rods as fit.
/// A build is accepted while it is a legal partial of that composition.
/// </summary>
public sealed record MatchesRowCompositions(
    int StepLength
);

/// <summary>
/// The moved rows must be exactly <see cref="ExpectedMovedRows"/>. Moving any
/// other row is rejected; a subset is accepted.
/// </summary>
public sealed record MatchesRowPartition(
    IReadOnlyList<int> ExpectedMovedRows
);

public enum SelectionRule
{
    /// <summary>The selection must equal <see cref="MatchesRowSelection.ExpectedRows"/>.</summary>
    ExactSet,

    /// <summary>Any <see cref="MatchesRowSelection.RequiredCount"/> rows that are neighbours in <see cref="MatchesRowSelection.SelectableRows"/>.</summary>
    AdjacentInList
}

/// <summary>
/// Rows may be selected only from <see cref="SelectableRows"/>. A partial
/// selection that could still complete is accepted; anything else is rejected.
/// </summary>
public sealed record MatchesRowSelection(
    IReadOnlyList<int> SelectableRows,
    int RequiredCount,
    SelectionRule Rule,
    IReadOnlyList<int> ExpectedRows
);

public union SuccessCheck(
    LengthsAreEquivalent,
    MatchesComputedFit,
    MatchesIntegerDomain,
    AllGapsTraversed,
    MatchesPartComposition,
    MatchesLatentScalar,
    MatchesLatentExpression,
    MatchesCorrectAnswer,
    MatchesRowCompositions,
    MatchesRowPartition,
    MatchesRowSelection
);

public enum ScalarReading
{
    UnitLength,
    RodCount
}
