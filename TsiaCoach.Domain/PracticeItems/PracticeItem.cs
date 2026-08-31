using System.Linq;

using TsiaCoach.Domain.Mathematics;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.Text;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.PracticeItems;

public readonly record struct MisconceptionCode(string Value);

public sealed record CorrectCheck;

public sealed record IncorrectCheck(
    MisconceptionCode Misconception
);

public union CheckOutcome(
    CorrectCheck,
    IncorrectCheck);

public sealed record PracticeItem(
    PracticeItemId Id,
    TextStructure Text,
    SemanticModel Semantics,
    MathematicsModel Mathematics,
    IReadOnlyList<AnswerChoice> Answers,
    IReadOnlyList<AnswerMathBinding> AnswerMathBindings,
    AnswerChoiceId CorrectAnswerId,
    IReadOnlyDictionary<AnswerChoiceId, MisconceptionCode> Distractors
)
{
    public static PracticeItem Create(
        PracticeItemId id,
        TextStructure text,
        SemanticModel semantics,
        MathematicsModel mathematics,
        IReadOnlyList<AnswerChoice> answers,
        IReadOnlyList<AnswerMathBinding> answerMathBindings,
        AnswerChoiceId correctAnswerId,
        IReadOnlyDictionary<AnswerChoiceId, MisconceptionCode> distractors)
    {
        var item = new PracticeItem(
            Id: id,
            Text: text,
            Semantics: semantics,
            Mathematics: mathematics,
            Answers: answers,
            AnswerMathBindings: answerMathBindings,
            CorrectAnswerId: correctAnswerId,
            Distractors: distractors);

        PracticeItemValidator.Validate(item);
        return item;
    }

    public CheckOutcome Evaluate(AnswerChoiceId answerChoiceId)
    {
        if (!Answers.Any(answer => answer.Id == answerChoiceId))
        {
            throw new InvalidOperationException(
                $"Answer choice '{answerChoiceId.Value}' does not belong to practice item '{Id.Value}'.");
        }

        return answerChoiceId == CorrectAnswerId
            ? new CorrectCheck()
            : new IncorrectCheck(Distractors[answerChoiceId]);
    }
}
