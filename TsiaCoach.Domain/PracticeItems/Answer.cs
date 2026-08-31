using TsiaCoach.Domain.ValueObjects;

using TsiaCoach.Domain.Text;

namespace TsiaCoach.Domain.PracticeItems;

public readonly record struct AnswerChoiceId(string Value);

public sealed record AnswerChoice(
    AnswerChoiceId Id,
    TokenSpan LabelSpan,
    CharacterSpan LabelCharacterSpan,
    TokenSpan ContentSpan,
    CharacterSpan ContentCharacterSpan
)
{
    public static AnswerChoice Create(
        AnswerChoiceId id,
        TokenSpan labelSpan,
        TokenSpan contentSpan,
        TextStructure text) =>
        new(
            Id: id,
            LabelSpan: labelSpan,
            LabelCharacterSpan: text.CharacterSpanFor(labelSpan),
            ContentSpan: contentSpan,
            ContentCharacterSpan: text.CharacterSpanFor(contentSpan));
}

public sealed record AnswerMathBinding(
    AnswerChoiceId AnswerChoiceId,
    MathObjectId MathObjectId
);
