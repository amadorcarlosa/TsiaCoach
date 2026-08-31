using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Text;

public sealed record TextStructure(
    IReadOnlyList<TextToken> Tokens,
    IReadOnlyList<SentenceSpan> Sentences,
    IReadOnlyList<PhraseSpan> Phrases
);

public sealed record TextToken(
    TokenId Id,
    TokenIndex Index,
    string Surface,
    TokenKind Kind
);

public sealed record SentenceSpan(
    SentenceId Id,
    TokenSpan Span
);

public sealed record PhraseSpan(
    PhraseId Id,
    TokenSpan Span
);

public enum TokenKind
{
    Word,
    Number,
    Symbol,
    Punctuation
}