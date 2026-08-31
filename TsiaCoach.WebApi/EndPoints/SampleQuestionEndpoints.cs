using Microsoft.AspNetCore.Http.HttpResults;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.Mathematics;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.ValueObjects;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.EndPoints;

public static class SampleQuestionEndpoints
{
    private static readonly IReadOnlyList<PracticeItem> Items =
    [
        PracticeItemOne.Item,
        PracticeItemTwo.Item
    ];

    public static RouteGroupBuilder MapSampleQuestions(this RouteGroupBuilder api)
    {
        RouteGroupBuilder questions = api.MapGroup("/sample-questions");

        questions.MapGet("/", GetAll)
            .WithName("GetSampleQuestions")
            .WithTags("Sample Questions")
            .Produces<PracticeItemResponse[]>(StatusCodes.Status200OK);

        questions.MapGet("/{id}", GetById)
            .WithName("GetSampleQuestionById")
            .WithTags("Sample Questions")
            .Produces<PracticeItemResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        return api;
    }

    private static Ok<PracticeItemResponse[]> GetAll() =>
        TypedResults.Ok(Items.Select(ToResponse).ToArray());

    private static Results<Ok<PracticeItemResponse>, NotFound> GetById(string id)
    {
        PracticeItem? item = Items.FirstOrDefault(candidate =>
            string.Equals(candidate.Id.Value, id, StringComparison.Ordinal));

        return item is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(ToResponse(item));
    }

    internal static PracticeItemResponse ToResponse(PracticeItem item) =>
        new(
            Id: item.Id.Value,
            Text: new(
                SourceText: item.Text.SourceText,
                Tokens: item.Text.Tokens.Select(token => new TextTokenResponse(
                    Id: token.Id.Value,
                    Index: token.Index.Value,
                    Surface: token.Surface,
                    Kind: ContractName(token.Kind),
                    CharacterSpan: ToResponse(token.CharacterSpan)
                )).ToArray(),
                Sentences: item.Text.Sentences.Select(sentence =>
                    new SentenceSpanResponse(
                        Id: sentence.Id.Value,
                        Span: ToResponse(sentence.Span),
                        CharacterSpan: ToResponse(sentence.CharacterSpan)
                    )).ToArray(),
                Phrases: item.Text.Phrases.Select(phrase =>
                    new PhraseSpanResponse(
                        Id: phrase.Id.Value,
                        Span: ToResponse(phrase.Span),
                        CharacterSpan: ToResponse(phrase.CharacterSpan)
                    )).ToArray()
            ),
            Semantics: new(
                Entities: item.Semantics.Entities.Select(ToResponse).ToArray(),
                Edges: item.Semantics.Edges.Select(ToResponse).ToArray(),
                LatentFacts: item.Semantics.LatentFacts.Select(ToResponse).ToArray()
            ),
            Mathematics: new(
                Objects: item.Mathematics.Objects.Select(ToResponse).ToArray(),
                TextBindings: item.Mathematics.TextBindings
                    .Select(binding => new MathTextBindingResponse(
                        MathObjectId: binding.MathObjectId.Value,
                        MathNodeId: binding.MathNodeId?.Value,
                        CharacterSpan: ToResponse(binding.CharacterSpan)
                    ))
                    .ToArray()
            ),
            Interaction: new MultipleChoiceInteractionResponse(
                Answers: item.Answers.Select(answer => new AnswerChoiceResponse(
                    Id: answer.Id.Value,
                    LabelSpan: ToResponse(answer.LabelSpan),
                    LabelCharacterSpan: ToResponse(answer.LabelCharacterSpan),
                    ContentSpan: ToResponse(answer.ContentSpan),
                    ContentCharacterSpan: ToResponse(answer.ContentCharacterSpan)
                )).ToArray(),
                AnswerMathBindings: item.AnswerMathBindings
                    .Select(binding => new AnswerMathBindingResponse(
                        AnswerChoiceId: binding.AnswerChoiceId.Value,
                        MathObjectId: binding.MathObjectId.Value
                    ))
                    .ToArray(),
                CorrectAnswerId: item.CorrectAnswerId.Value)
        );

    private static TokenSpanResponse ToResponse(TokenSpan span) =>
        new(span.Start.Value, span.Length);

    private static CharacterSpanResponse ToResponse(CharacterSpan span) =>
        new(span.Start, span.Length);

    private static MathObjectResponse ToResponse(MathObject value) =>
        new(
            Id: value.Id.Value,
            RootNodeId: value.RootNodeId.Value,
            Nodes: value.Nodes.Select(node => new MathNodeResponse(
                Id: node.Id.Value,
                Kind: ContractName(node.Kind),
                Value: node.Value,
                ChildNodeIds: node.ChildNodeIds
                    .Select(id => id.Value)
                    .ToArray()
            )).ToArray()
        );

    private static SemanticEntityResponse ToResponse(SemanticEntity entity) =>
        entity.Value switch
        {
            VariableQuantity value => new VariableQuantityResponse(
                Id: value.Id.Value,
                SymbolId: value.SymbolId.Value,
                Name: value.Name.Value,
                DeclaredByTokenId: value.DeclaredByTokenId.Value
            ),
            DerivedQuantity value => new DerivedQuantityResponse(
                Id: value.Id.Value,
                DeclaredBySentenceId: value.DeclaredBySentenceId.Value
            ),
            OrderedSet value => new OrderedSetResponse(
                Id: value.Id.Value,
                DeclaredByPhraseId: value.DeclaredByPhraseId.Value,
                Cardinality: value.Cardinality,
                Domain: ContractName(value.Domain)
            ),
            _ => throw new InvalidOperationException(
                $"Unsupported semantic entity case: {entity.Value?.GetType().Name ?? "null"}.")
        };

    private static SemanticEdgeResponse ToResponse(SemanticEdge edge) =>
        edge.Value switch
        {
            SelectsElement value => new SelectsElementResponse(
                QuantityId: value.QuantityId.Value,
                CollectionId: value.CollectionId.Value,
                Selector: ContractName(value.Selector),
                AnchoredByPhraseId: value.AnchoredByPhraseId.Value
            ),
            RefersTo value => new RefersToResponse(
                AnaphorPhraseId: value.AnaphorPhraseId.Value,
                ReferentId: value.ReferentId.Value
            ),
            DerivesFrom value => new DerivesFromResponse(
                TargetEntityId: value.TargetEntityId.Value,
                SourceEntityId: value.SourceEntityId.Value,
                OperationsInBuildOrder: value.OperationsInBuildOrder
                    .Select(ToResponse)
                    .ToArray()
            ),
            RequestsValue value => new RequestsValueResponse(
                RequestedByPhraseId: value.RequestedByPhraseId.Value,
                RequestedEntityId: value.RequestedEntityId.Value
            ),
            RequestsOperation value => new RequestsOperationResponse(
                RequestedByPhraseId: value.RequestedByPhraseId.Value,
                Operation: ContractName(value.Operation),
                OperandEntityId: value.OperandEntityId.Value
            ),
            _ => throw new InvalidOperationException(
                $"Unsupported semantic edge case: {edge.Value?.GetType().Name ?? "null"}.")
        };

    private static DerivationOperationResponse ToResponse(DerivationOperation operation) =>
        operation.Value switch
        {
            ScaleBy value => new ScaleByResponse(
                AnchoredByPhraseId: value.AnchoredByPhraseId.Value,
                ScaleFactorId: value.ScaleFactorId.Value
            ),
            IncrementBy value => new IncrementByResponse(
                AnchoredByPhraseId: value.AnchoredByPhraseId.Value,
                IncrementId: value.IncrementId.Value
            ),
            _ => throw new InvalidOperationException(
                $"Unsupported derivation operation case: {operation.Value?.GetType().Name ?? "null"}.")
        };

    private static LatentMathResponse ToResponse(LatentMath latentMath) =>
        latentMath.Value switch
        {
            DerivedScalar value => new DerivedScalarResponse(
                Id: value.Id.Value,
                Meaning: ContractName(value.Meaning),
                Value: value.Value,
                Provenance: ToResponse(value.Provenance)
            ),
            DerivedExpression value => new DerivedExpressionResponse(
                Id: value.Id.Value,
                Meaning: ContractName(value.Meaning),
                MathObjectId: value.MathObjectId.Value,
                Provenance: ToResponse(value.Provenance)
            ),
            _ => throw new InvalidOperationException(
                $"Unsupported latent math case: {latentMath.Value?.GetType().Name ?? "null"}.")
        };

    private static LatentMathProvenanceResponse ToResponse(
        LatentMathProvenance provenance) =>
        new(
            Origin: ContractName(provenance.Origin),
            AnchorPhraseIds: provenance.AnchorPhraseIds
                .Select(id => id.Value)
                .ToArray(),
            SourceEntityIds: provenance.SourceEntityIds
                .Select(id => id.Value)
                .ToArray(),
            SourceLatentMathIds: provenance.SourceLatentMathIds
                .Select(id => id.Value)
                .ToArray()
        );

    private static string ContractName<TEnum>(TEnum value)
        where TEnum : struct, Enum
    {
        string name = value.ToString();

        return name.Length == 0
            ? name
            : char.ToLowerInvariant(name[0]) + name[1..];
    }
}
