using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Semantics;



public sealed record VariableQuantity(
    SemanticEntityId Id,
    SymbolId SymbolId,
    SymbolName Name,
    TokenId DeclaredByTokenId
);

public sealed record DerivedQuantity(
    SemanticEntityId Id,
    SentenceId DeclaredBySentenceId
);

public sealed record OrderedSet(
    SemanticEntityId Id,
    PhraseId DeclaredByPhraseId,
    int Cardinality,
    IntegerDomain Domain
);

public union SemanticEntity(
VariableQuantity,
DerivedQuantity,
OrderedSet
);

public enum IntegerDomain
{
    Integers,
    OddIntegers,
    EvenIntegers
}