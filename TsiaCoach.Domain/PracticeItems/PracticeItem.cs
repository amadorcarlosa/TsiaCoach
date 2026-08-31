using TsiaCoach.Domain.Text;
using TsiaCoach.Domain.ValueObjects;
using TsiaCoach.Domain.Semantics;

namespace TsiaCoach.Domain.PracticeItems;

public sealed record PracticeItem(
    PracticeItemId Id,
    TextStructure Text,
    SemanticModel Semantics,
    IReadOnlyList<AnswerChoice> Answers,
    AnswerChoiceId CorrectAnswerId
);
