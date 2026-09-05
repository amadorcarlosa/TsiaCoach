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

/// <summary>The learner's whole build so far, as <see cref="RodPlacement"/>s, resubmitted on every drop.</summary>
public sealed record PlacePiecesSubmission
{
    public PlacePiecesSubmission(IReadOnlyList<RodPlacement> pieces)
    {
        Pieces = new ReadOnlyCollection<RodPlacement>(pieces.ToArray());
    }

    public IReadOnlyList<RodPlacement> Pieces { get; }
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
