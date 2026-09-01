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

public union ScaffoldStepSubmission(
    MatchEquivalentLengthSubmission,
    ClassifyByFitSubmission,
    NameFitClassificationSubmission,
    TraverseAllGapsSubmission,
    JoinQuantitiesSubmission,
    EnterScalarSubmission,
    BuildExpressionSubmission,
    SelectAnswerChoiceSubmission);
