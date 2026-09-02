using System.Collections.ObjectModel;

using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Scaffolds.Evaluation;

public sealed record MatchEquivalentLengthSubmission(
    RodCount UnitRodCount);

public sealed record FitClassificationEntry(
    UnitLength Length,
    FitClassification Classification);

public sealed record ClassifyByFitSubmission
{
    public ClassifyByFitSubmission(IReadOnlyList<FitClassificationEntry> classifications)
    {
        Classifications = new ReadOnlyCollection<FitClassificationEntry>(
            classifications.ToArray());
    }

    public IReadOnlyList<FitClassificationEntry> Classifications { get; }
}

public sealed record NameFitClassificationSubmission(
    IntegerDomain Domain);

public sealed record GapTraversal(
    UnitLength From,
    UnitLength To,
    ScaffoldResourceId ResourceId);

public sealed record TraverseAllGapsSubmission
{
    public TraverseAllGapsSubmission(IReadOnlyList<GapTraversal> traversals)
    {
        Traversals = new ReadOnlyCollection<GapTraversal>(
            traversals.ToArray());
    }

    public IReadOnlyList<GapTraversal> Traversals { get; }
}

public sealed record JoinQuantitiesSubmission
{
    public JoinQuantitiesSubmission(IReadOnlyList<QuantityReference> parts)
    {
        Parts = new ReadOnlyCollection<QuantityReference>(
            parts.ToArray());
    }

    public IReadOnlyList<QuantityReference> Parts { get; }
}

public sealed record EnterScalarSubmission(
    decimal Value);

public sealed record BuildExpressionSubmission(
    MathObjectId MathObjectId);

public sealed record SelectAnswerChoiceSubmission(
    AnswerChoiceId AnswerChoiceId);

/// <summary>A rod the learner has placed on the grid: length, and the cell it starts in.</summary>
public sealed record PlacedPiece(
    int Length,
    int X,
    int Y);

/// <summary>The learner's whole build so far, resubmitted on every drop.</summary>
public sealed record PlacePiecesSubmission
{
    public PlacePiecesSubmission(IReadOnlyList<PlacedPiece> pieces)
    {
        Pieces = new ReadOnlyCollection<PlacedPiece>(pieces.ToArray());
    }

    public IReadOnlyList<PlacedPiece> Pieces { get; }
}

/// <summary>The rows whose trains the learner has moved to the compare column.</summary>
public sealed record MoveRowsSubmission
{
    public MoveRowsSubmission(IReadOnlyList<int> movedRows)
    {
        MovedRows = new ReadOnlyCollection<int>(movedRows.ToArray());
    }

    public IReadOnlyList<int> MovedRows { get; }
}

/// <summary>The rows the learner has selected.</summary>
public sealed record SelectRowsSubmission
{
    public SelectRowsSubmission(IReadOnlyList<int> rows)
    {
        Rows = new ReadOnlyCollection<int>(rows.ToArray());
    }

    public IReadOnlyList<int> Rows { get; }
}

public union ScaffoldStepSubmission(
    MatchEquivalentLengthSubmission,
    ClassifyByFitSubmission,
    NameFitClassificationSubmission,
    TraverseAllGapsSubmission,
    JoinQuantitiesSubmission,
    EnterScalarSubmission,
    BuildExpressionSubmission,
    SelectAnswerChoiceSubmission,
    PlacePiecesSubmission,
    MoveRowsSubmission,
    SelectRowsSubmission);
