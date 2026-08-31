using System.Text.Json.Serialization;

namespace TsiaCoach.WebApi.Response;

public sealed record PracticeItemResponse(
    string Id,
    TextStructureResponse Text,
    SemanticModelResponse Semantics,
    IReadOnlyList<AnswerChoiceResponse> Answers,
    string CorrectAnswerId
);

public sealed record TextStructureResponse(
    IReadOnlyList<TextTokenResponse> Tokens,
    IReadOnlyList<SentenceSpanResponse> Sentences,
    IReadOnlyList<PhraseSpanResponse> Phrases
);

public sealed record TextTokenResponse(
    string Id,
    int Index,
    string Surface,
    string Kind
);

public sealed record TokenSpanResponse(
    int Start,
    int Length
);

public sealed record SentenceSpanResponse(
    string Id,
    TokenSpanResponse Span
);

public sealed record PhraseSpanResponse(
    string Id,
    TokenSpanResponse Span
);

public sealed record AnswerChoiceResponse(
    string Id,
    TokenSpanResponse LabelSpan,
    TokenSpanResponse ContentSpan
);

public sealed record SemanticModelResponse(
    IReadOnlyList<SemanticEntityResponse> Entities,
    IReadOnlyList<SemanticEdgeResponse> Edges,
    IReadOnlyList<LatentMathResponse> LatentFacts
);

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(VariableQuantityResponse), "variableQuantity")]
[JsonDerivedType(typeof(DerivedQuantityResponse), "derivedQuantity")]
[JsonDerivedType(typeof(OrderedSetResponse), "orderedSet")]
public abstract record SemanticEntityResponse;

public sealed record VariableQuantityResponse(
    string Id,
    string SymbolId,
    string Name,
    string DeclaredByTokenId
) : SemanticEntityResponse;

public sealed record DerivedQuantityResponse(
    string Id,
    string DeclaredBySentenceId
) : SemanticEntityResponse;

public sealed record OrderedSetResponse(
    string Id,
    string DeclaredByPhraseId,
    int Cardinality,
    string Domain
) : SemanticEntityResponse;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(SelectsElementResponse), "selectsElement")]
[JsonDerivedType(typeof(RefersToResponse), "refersTo")]
[JsonDerivedType(typeof(DerivesFromResponse), "derivesFrom")]
[JsonDerivedType(typeof(RequestsValueResponse), "requestsValue")]
[JsonDerivedType(typeof(RequestsOperationResponse), "requestsOperation")]
public abstract record SemanticEdgeResponse;

public sealed record SelectsElementResponse(
    string QuantityId,
    string CollectionId,
    string Selector,
    string AnchoredByPhraseId
) : SemanticEdgeResponse;

public sealed record RefersToResponse(
    string AnaphorPhraseId,
    string ReferentId
) : SemanticEdgeResponse;

public sealed record DerivesFromResponse(
    string TargetEntityId,
    string SourceEntityId,
    IReadOnlyList<DerivationOperationResponse> OperationsInBuildOrder
) : SemanticEdgeResponse;

public sealed record RequestsValueResponse(
    string RequestedByPhraseId,
    string RequestedEntityId
) : SemanticEdgeResponse;

public sealed record RequestsOperationResponse(
    string RequestedByPhraseId,
    string Operation,
    string OperandEntityId
) : SemanticEdgeResponse;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(ScaleByResponse), "scaleBy")]
[JsonDerivedType(typeof(IncrementByResponse), "incrementBy")]
public abstract record DerivationOperationResponse;

public sealed record ScaleByResponse(
    string AnchoredByPhraseId,
    string ScaleFactorId
) : DerivationOperationResponse;

public sealed record IncrementByResponse(
    string AnchoredByPhraseId,
    string IncrementId
) : DerivationOperationResponse;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(DerivedScalarResponse), "derivedScalar")]
[JsonDerivedType(typeof(DerivedExpressionResponse), "derivedExpression")]
public abstract record LatentMathResponse;

public sealed record DerivedScalarResponse(
    string Id,
    string Meaning,
    decimal Value,
    LatentMathProvenanceResponse Provenance
) : LatentMathResponse;

public sealed record DerivedExpressionResponse(
    string Id,
    string Meaning,
    string MathObjectId,
    LatentMathProvenanceResponse Provenance
) : LatentMathResponse;

public sealed record LatentMathProvenanceResponse(
    string Origin,
    IReadOnlyList<string> AnchorPhraseIds,
    IReadOnlyList<string> SourceEntityIds,
    IReadOnlyList<string> SourceLatentMathIds
);
