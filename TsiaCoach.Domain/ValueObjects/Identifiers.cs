namespace TsiaCoach.Domain.ValueObjects;

public readonly record struct PracticeItemId(string Value);
public readonly record struct TokenId(string Value);
public readonly record struct SentenceId(string Value);
public readonly record struct PhraseId(string Value);

public readonly record struct SemanticEntityId(string Value);
public readonly record struct MathObjectId(string Value);
public readonly record struct MathNodeId(string Value);
public readonly record struct SymbolId(string Value);
public readonly record struct LatentMathId(string Value);