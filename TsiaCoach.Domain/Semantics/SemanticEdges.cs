

using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Semantics;

public sealed record SelectsElement(
    SemanticEntityId QuantityId,
    SemanticEntityId CollectionId,
    ElementSelector Selector,
    PhraseId AnchoredByPhraseId
);

public sealed record RefersTo(
    PhraseId AnaphorPhraseId,
    SemanticEntityId ReferentId
);

public sealed record DerivesFrom(
    SemanticEntityId TargetEntityId,
    SemanticEntityId SourceEntityId,
    IReadOnlyList<DerivationOperation> OperationsInBuildOrder
);

public sealed record RequestsValue(
    PhraseId RequestedByPhraseId,
    SemanticEntityId RequestedEntityId
);

public sealed record RequestsOperation(
    PhraseId RequestedByPhraseId,
    OperationKind Operation,
    SemanticEntityId OperandEntityId
);

public union SemanticEdge(
    SelectsElement,
    RefersTo,
    DerivesFrom,
    RequestsValue,
    RequestsOperation
);

public sealed record ScaleBy(
    PhraseId AnchoredByPhraseId,
    LatentMathId ScaleFactorId
);

public sealed record IncrementBy(
    PhraseId AnchoredByPhraseId,
    LatentMathId IncrementId
);

public union DerivationOperation(
    ScaleBy,
    IncrementBy
);

public enum ElementSelector
{
    Least,
    Greatest
}

public enum OperationKind
{
    Sum
}