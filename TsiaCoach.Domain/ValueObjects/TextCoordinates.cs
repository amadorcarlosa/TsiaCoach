namespace TsiaCoach.Domain.ValueObjects;

public readonly record struct TokenIndex(int Value);

public readonly record struct TokenSpan(
    TokenIndex Start,
    int Length
);