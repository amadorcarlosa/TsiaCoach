using TsiaCoach.Domain.Text;
using TsiaCoach.Domain.ValueObjects;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.Mathematics;

namespace TsiaCoach.Domain.PracticeItems;

public sealed record PracticeItem(
    PracticeItemId Id,
    TextStructure Text,
    SemanticModel Semantics,
    MathematicsModel Mathematics,
    IReadOnlyList<AnswerChoice> Answers,
    IReadOnlyList<AnswerMathBinding> AnswerMathBindings,
    AnswerChoiceId CorrectAnswerId
);
