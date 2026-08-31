using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.PracticeItems;

public readonly record struct AnswerChoiceId(string Value);

public sealed record AnswerChoice(
    AnswerChoiceId Id,
    TokenSpan LabelSpan,
    TokenSpan ContentSpan
);