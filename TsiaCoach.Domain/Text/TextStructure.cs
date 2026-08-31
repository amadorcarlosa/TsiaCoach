using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Text;

public sealed record TextStructure(
    string SourceText,
    IReadOnlyList<TextToken> Tokens,
    IReadOnlyList<SentenceSpan> Sentences,
    IReadOnlyList<PhraseSpan> Phrases
)
{
    public static TextStructure Create(
        string sourceText,
        IReadOnlyList<TextToken> tokens,
        IReadOnlyList<SentenceSpan> sentences,
        IReadOnlyList<PhraseSpan> phrases)
    {
        ArgumentNullException.ThrowIfNull(sourceText);

        var cursor = 0;
        TextToken[] boundTokens = tokens
            .OrderBy(token => token.Index.Value)
            .Select(token =>
            {
                int start = sourceText.IndexOf(
                    token.Surface,
                    cursor,
                    StringComparison.Ordinal);

                if (start < 0)
                {
                    throw new InvalidOperationException(
                        $"Token '{token.Id.Value}' with surface '{token.Surface}' " +
                        "does not occur in source order.");
                }

                cursor = start + token.Surface.Length;

                return token with
                {
                    CharacterSpan = new(start, token.Surface.Length)
                };
            })
            .ToArray();

        var text = new TextStructure(
            SourceText: sourceText,
            Tokens: boundTokens,
            Sentences: [],
            Phrases: []);

        return text with
        {
            Sentences = sentences
                .Select(sentence => sentence with
                {
                    CharacterSpan = text.CharacterSpanFor(sentence.Span)
                })
                .ToArray(),
            Phrases = phrases
                .Select(phrase => phrase with
                {
                    CharacterSpan = text.CharacterSpanFor(phrase.Span)
                })
                .ToArray()
        };
    }

    public CharacterSpan CharacterSpanFor(TokenSpan tokenSpan)
    {
        if (tokenSpan.Length <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(tokenSpan),
                "Token spans must contain at least one token.");
        }

        int startIndex = tokenSpan.Start.Value;
        int endIndex = startIndex + tokenSpan.Length - 1;

        if (startIndex < 0 || endIndex >= Tokens.Count)
        {
            throw new ArgumentOutOfRangeException(
                nameof(tokenSpan),
                "Token span falls outside the source token collection.");
        }

        CharacterSpan first = Tokens[startIndex].CharacterSpan;
        CharacterSpan last = Tokens[endIndex].CharacterSpan;

        return new(first.Start, last.End - first.Start);
    }
}

public sealed record TextToken(
    TokenId Id,
    TokenIndex Index,
    string Surface,
    TokenKind Kind,
    CharacterSpan CharacterSpan
)
{
    public TextToken(
        TokenId id,
        TokenIndex index,
        string surface,
        TokenKind kind)
        : this(id, index, surface, kind, default)
    {
    }
}

public sealed record SentenceSpan(
    SentenceId Id,
    TokenSpan Span,
    CharacterSpan CharacterSpan
)
{
    public SentenceSpan(SentenceId Id, TokenSpan Span)
        : this(Id, Span, default)
    {
    }
}

public sealed record PhraseSpan(
    PhraseId Id,
    TokenSpan Span,
    CharacterSpan CharacterSpan
)
{
    public PhraseSpan(PhraseId Id, TokenSpan Span)
        : this(Id, Span, default)
    {
    }
}

public enum TokenKind
{
    Word,
    Number,
    Symbol,
    Punctuation
}
