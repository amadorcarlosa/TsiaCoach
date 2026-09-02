using System.Text.Json.Serialization;

using TsiaCoach.Domain.Scaffolds.Evaluation;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.WebApi.Request;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(MatchEquivalentLengthSubmissionRequest), "matchEquivalentLength")]
[JsonDerivedType(typeof(ClassifyByFitSubmissionRequest), "classifyByFit")]
[JsonDerivedType(typeof(NameFitClassificationSubmissionRequest), "nameFitClassification")]
[JsonDerivedType(typeof(TraverseAllGapsSubmissionRequest), "traverseAllGaps")]
[JsonDerivedType(typeof(JoinQuantitiesSubmissionRequest), "joinQuantities")]
[JsonDerivedType(typeof(EnterScalarSubmissionRequest), "enterScalar")]
[JsonDerivedType(typeof(BuildExpressionSubmissionRequest), "buildExpression")]
[JsonDerivedType(typeof(SelectAnswerChoiceSubmissionRequest), "selectAnswerChoice")]
[JsonDerivedType(typeof(PlacePiecesSubmissionRequest), "placePieces")]
[JsonDerivedType(typeof(MoveRowsSubmissionRequest), "moveRows")]
[JsonDerivedType(typeof(SelectRowsSubmissionRequest), "selectRows")]
public abstract record ScaffoldStepSubmissionRequest;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record MatchEquivalentLengthSubmissionRequest(
    int UnitRodCount) : ScaffoldStepSubmissionRequest;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record FitClassificationEntryRequest(
    int Length,
    FitClassification Classification);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ClassifyByFitSubmissionRequest(
    IReadOnlyList<FitClassificationEntryRequest>? Classifications)
    : ScaffoldStepSubmissionRequest;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record NameFitClassificationSubmissionRequest(
    IntegerDomain Domain) : ScaffoldStepSubmissionRequest;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record GapTraversalRequest(
    int From,
    int To,
    string ResourceId);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record TraverseAllGapsSubmissionRequest(
    IReadOnlyList<GapTraversalRequest>? Traversals)
    : ScaffoldStepSubmissionRequest;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(SemanticQuantityReferenceRequest), "semanticQuantity")]
[JsonDerivedType(typeof(LatentExpressionReferenceRequest), "latentExpression")]
public abstract record QuantityReferenceRequest;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record SemanticQuantityReferenceRequest(
    string SemanticEntityId) : QuantityReferenceRequest;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record LatentExpressionReferenceRequest(
    string LatentMathId) : QuantityReferenceRequest;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record JoinQuantitiesSubmissionRequest(
    IReadOnlyList<QuantityReferenceRequest>? Parts)
    : ScaffoldStepSubmissionRequest;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record EnterScalarSubmissionRequest(
    decimal Value) : ScaffoldStepSubmissionRequest;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record BuildExpressionSubmissionRequest(
    string MathObjectId) : ScaffoldStepSubmissionRequest;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record SelectAnswerChoiceSubmissionRequest(
    string AnswerChoiceId) : ScaffoldStepSubmissionRequest;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record PlacedPieceRequest(
    int Length,
    int X,
    int Y);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record PlacePiecesSubmissionRequest(
    IReadOnlyList<PlacedPieceRequest>? Pieces)
    : ScaffoldStepSubmissionRequest;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record MoveRowsSubmissionRequest(
    IReadOnlyList<int>? MovedRows)
    : ScaffoldStepSubmissionRequest;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record SelectRowsSubmissionRequest(
    IReadOnlyList<int>? Rows)
    : ScaffoldStepSubmissionRequest;

internal static class ScaffoldStepSubmissionRequestMapper
{
    public static ScaffoldStepSubmission ToDomain(
        ScaffoldStepSubmissionRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        return request switch
        {
            MatchEquivalentLengthSubmissionRequest value =>
                new MatchEquivalentLengthSubmission(new RodCount(value.UnitRodCount)),
            ClassifyByFitSubmissionRequest value =>
                new ClassifyByFitSubmission(
                    RequireCollection(value.Classifications, "classifications")
                        .Select(entry =>
                        {
                            FitClassificationEntryRequest item =
                                RequireEntry(entry, "classifications");
                            return new FitClassificationEntry(
                                new UnitLength(item.Length),
                                item.Classification);
                        })
                        .ToArray()),
            NameFitClassificationSubmissionRequest value =>
                new NameFitClassificationSubmission(value.Domain),
            TraverseAllGapsSubmissionRequest value =>
                new TraverseAllGapsSubmission(
                    RequireCollection(value.Traversals, "traversals")
                        .Select(entry =>
                        {
                            GapTraversalRequest item =
                                RequireEntry(entry, "traversals");
                            return new GapTraversal(
                                new UnitLength(item.From),
                                new UnitLength(item.To),
                                RequireId(item.ResourceId, "resourceId", id => new ScaffoldResourceId(id)));
                        })
                        .ToArray()),
            JoinQuantitiesSubmissionRequest value =>
                new JoinQuantitiesSubmission(
                    RequireCollection(value.Parts, "parts")
                        .Select(entry => ToDomain(RequireEntry(entry, "parts")))
                        .ToArray()),
            EnterScalarSubmissionRequest value =>
                new EnterScalarSubmission(value.Value),
            BuildExpressionSubmissionRequest value =>
                new BuildExpressionSubmission(
                    RequireId(value.MathObjectId, "mathObjectId", id => new MathObjectId(id))),
            SelectAnswerChoiceSubmissionRequest value =>
                new SelectAnswerChoiceSubmission(
                    RequireId(value.AnswerChoiceId, "answerChoiceId", id => new AnswerChoiceId(id))),
            PlacePiecesSubmissionRequest value =>
                new PlacePiecesSubmission(
                    RequireCollection(value.Pieces, "pieces")
                        .Select(entry =>
                        {
                            PlacedPieceRequest item = RequireEntry(entry, "pieces");
                            return new PlacedPiece(item.Length, item.X, item.Y);
                        })
                        .ToArray()),
            MoveRowsSubmissionRequest value =>
                new MoveRowsSubmission(RequireCollection(value.MovedRows, "movedRows")),
            SelectRowsSubmissionRequest value =>
                new SelectRowsSubmission(RequireCollection(value.Rows, "rows")),
            _ => throw new InvalidOperationException(
                $"Unsupported scaffold submission request '{request.GetType().Name}'.")
        };
    }

    private static QuantityReference ToDomain(
        QuantityReferenceRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        return request switch
        {
            SemanticQuantityReferenceRequest value =>
                new SemanticQuantityReference(
                    RequireId(value.SemanticEntityId, "semanticEntityId", id => new SemanticEntityId(id))),
            LatentExpressionReferenceRequest value =>
                new LatentExpressionReference(
                    RequireId(value.LatentMathId, "latentMathId", id => new LatentMathId(id))),
            _ => throw new InvalidOperationException(
                $"Unsupported quantity reference request '{request.GetType().Name}'.")
        };
    }

    private static T RequireEntry<T>(T? value, string name)
        where T : class =>
        value ?? throw new InvalidOperationException($"'{name}' cannot contain null entries.");

    private static IReadOnlyList<T> RequireCollection<T>(
        IReadOnlyList<T>? values,
        string name)
    {
        if (values is null)
        {
            throw new InvalidOperationException($"'{name}' is required.");
        }

        return values;
    }

    private static TId RequireId<TId>(
        string? value,
        string name,
        Func<string, TId> create)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"'{name}' is required.");
        }

        return create(value);
    }
}
