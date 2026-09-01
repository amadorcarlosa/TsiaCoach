using TsiaCoach.Domain.Mathematics;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.WebApi.Response;

public static class SampleQuestionResponseMapper
{
    public static PracticeItemResponse ToResponse(PracticeItem item) =>
        new(
            Id: item.Id.Value,
            Text: ToTextResponse(item),
            Semantics: new(
                Entities: item.Semantics.Entities.Select(ToResponse).ToArray(),
                Edges: item.Semantics.Edges.Select(ToResponse).ToArray(),
                LatentFacts: item.Semantics.LatentFacts.Select(ToResponse).ToArray()),
            Mathematics: ToMathematicsResponse(item),
            Interaction: new MultipleChoiceInteractionResponse(
                Answers: item.Answers.Select(ToAnswerResponse).ToArray(),
                AnswerMathBindings: item.AnswerMathBindings
                    .Select(binding => new AnswerMathBindingResponse(
                        binding.AnswerChoiceId.Value,
                        binding.MathObjectId.Value))
                    .ToArray(),
                CorrectAnswerId: item.CorrectAnswerId.Value));

    public static PracticeItemPromptResponse ToPromptResponse(PracticeItem item) =>
        new(
            Id: item.Id.Value,
            Text: ToTextResponse(item),
            Semantics: new(
                Entities: item.Semantics.Entities.Select(ToResponse).ToArray(),
                Edges: item.Semantics.Edges.Select(ToResponse).ToArray()),
            Mathematics: ToMathematicsResponse(item),
            Interaction: new PromptMultipleChoiceInteractionResponse(
                Answers: item.Answers.Select(ToAnswerResponse).ToArray(),
                AnswerMathBindings: item.AnswerMathBindings
                    .Select(binding => new AnswerMathBindingResponse(
                        binding.AnswerChoiceId.Value,
                        binding.MathObjectId.Value))
                    .ToArray()));

    private static TextStructureResponse ToTextResponse(PracticeItem item) =>
        new(
            SourceText: item.Text.SourceText,
            Tokens: item.Text.Tokens.Select(token => new TextTokenResponse(
                token.Id.Value,
                token.Index.Value,
                token.Surface,
                ContractName(token.Kind),
                ToResponse(token.CharacterSpan))).ToArray(),
            Sentences: item.Text.Sentences.Select(sentence => new SentenceSpanResponse(
                sentence.Id.Value,
                ToResponse(sentence.Span),
                ToResponse(sentence.CharacterSpan))).ToArray(),
            Phrases: item.Text.Phrases.Select(phrase => new PhraseSpanResponse(
                phrase.Id.Value,
                ToResponse(phrase.Span),
                ToResponse(phrase.CharacterSpan))).ToArray());

    private static MathematicsResponse ToMathematicsResponse(PracticeItem item) =>
        new(
            Objects: item.Mathematics.Objects.Select(ToResponse).ToArray(),
            TextBindings: item.Mathematics.TextBindings.Select(binding =>
                new MathTextBindingResponse(
                    binding.MathObjectId.Value,
                    binding.MathNodeId?.Value,
                    ToResponse(binding.CharacterSpan))).ToArray());

    private static AnswerChoiceResponse ToAnswerResponse(AnswerChoice answer) =>
        new(
            answer.Id.Value,
            ToResponse(answer.LabelSpan),
            ToResponse(answer.LabelCharacterSpan),
            ToResponse(answer.ContentSpan),
            ToResponse(answer.ContentCharacterSpan));

    private static TokenSpanResponse ToResponse(TokenSpan span) =>
        new(span.Start.Value, span.Length);

    private static CharacterSpanResponse ToResponse(CharacterSpan span) =>
        new(span.Start, span.Length);

    private static MathObjectResponse ToResponse(MathObject value) =>
        new(
            value.Id.Value,
            value.RootNodeId.Value,
            value.Nodes.Select(node => new MathNodeResponse(
                node.Id.Value,
                ContractName(node.Kind),
                node.Value,
                node.ChildNodeIds.Select(id => id.Value).ToArray())).ToArray());

    private static SemanticEntityResponse ToResponse(SemanticEntity entity) =>
        entity.Value switch
        {
            VariableQuantity value => new VariableQuantityResponse(
                value.Id.Value,
                value.SymbolId.Value,
                value.Name.Value,
                value.DeclaredByTokenId.Value),
            DerivedQuantity value => new DerivedQuantityResponse(
                value.Id.Value,
                value.DeclaredBySentenceId.Value),
            OrderedSet value => new OrderedSetResponse(
                value.Id.Value,
                value.DeclaredByPhraseId.Value,
                value.Cardinality,
                ContractName(value.Domain)),
            _ => throw new InvalidOperationException(
                $"Unsupported semantic entity case: {entity.Value?.GetType().Name ?? "null"}.")
        };

    private static SemanticEdgeResponse ToResponse(SemanticEdge edge) =>
        edge.Value switch
        {
            SelectsElement value => new SelectsElementResponse(
                value.QuantityId.Value,
                value.CollectionId.Value,
                ContractName(value.Selector),
                value.AnchoredByPhraseId.Value),
            RefersTo value => new RefersToResponse(
                value.AnaphorPhraseId.Value,
                value.ReferentId.Value),
            DerivesFrom value => new DerivesFromResponse(
                value.TargetEntityId.Value,
                value.SourceEntityId.Value,
                value.OperationsInBuildOrder.Select(ToResponse).ToArray()),
            RequestsValue value => new RequestsValueResponse(
                value.RequestedByPhraseId.Value,
                value.RequestedEntityId.Value),
            RequestsOperation value => new RequestsOperationResponse(
                value.RequestedByPhraseId.Value,
                ContractName(value.Operation),
                value.OperandEntityId.Value),
            _ => throw new InvalidOperationException(
                $"Unsupported semantic edge case: {edge.Value?.GetType().Name ?? "null"}.")
        };

    private static DerivationOperationResponse ToResponse(DerivationOperation operation) =>
        operation.Value switch
        {
            ScaleBy value => new ScaleByResponse(
                value.AnchoredByPhraseId.Value,
                value.ScaleFactorId.Value),
            IncrementBy value => new IncrementByResponse(
                value.AnchoredByPhraseId.Value,
                value.IncrementId.Value),
            _ => throw new InvalidOperationException(
                $"Unsupported derivation operation case: {operation.Value?.GetType().Name ?? "null"}.")
        };

    internal static LatentMathResponse ToResponse(LatentMath latentMath) =>
        latentMath.Value switch
        {
            DerivedScalar value => new DerivedScalarResponse(
                value.Id.Value,
                ContractName(value.Meaning),
                value.Value,
                ToResponse(value.Provenance)),
            DerivedExpression value => new DerivedExpressionResponse(
                value.Id.Value,
                ContractName(value.Meaning),
                value.MathObjectId.Value,
                ToResponse(value.Provenance)),
            _ => throw new InvalidOperationException(
                $"Unsupported latent math case: {latentMath.Value?.GetType().Name ?? "null"}.")
        };

    private static LatentMathProvenanceResponse ToResponse(LatentMathProvenance provenance) =>
        new(
            ContractName(provenance.Origin),
            provenance.AnchorPhraseIds.Select(id => id.Value).ToArray(),
            provenance.SourceEntityIds.Select(id => id.Value).ToArray(),
            provenance.SourceLatentMathIds.Select(id => id.Value).ToArray());

    private static string ContractName<TEnum>(TEnum value)
        where TEnum : struct, Enum
    {
        string name = value.ToString();
        return name.Length == 0
            ? name
            : char.ToLowerInvariant(name[0]) + name[1..];
    }
}
