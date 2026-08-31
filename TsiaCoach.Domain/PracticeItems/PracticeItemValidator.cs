using System.Linq;

using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.PracticeItems;

public static class PracticeItemValidator
{
    public static void Validate(PracticeItem practiceItem)
    {
        var answerIds = EnsureUnique(
            practiceItem.Answers.Select(answer => answer.Id),
            id => id.Value,
            "answer");

        if (answerIds.Count == 0)
        {
            throw new InvalidOperationException(
                $"Practice item '{practiceItem.Id.Value}' must contain at least one answer.");
        }

        if (!answerIds.Contains(practiceItem.CorrectAnswerId))
        {
            throw new InvalidOperationException(
                $"Practice item '{practiceItem.Id.Value}' has unknown correct answer id '{practiceItem.CorrectAnswerId.Value}'.");
        }

        EnsureUnique(
            practiceItem.Distractors.Keys,
            id => id.Value,
            "distractor");

        if (practiceItem.Distractors.ContainsKey(practiceItem.CorrectAnswerId))
        {
            throw new InvalidOperationException(
                $"Practice item '{practiceItem.Id.Value}' cannot include the correct answer '{practiceItem.CorrectAnswerId.Value}' as a distractor.");
        }

        foreach (var (answerChoiceId, code) in practiceItem.Distractors)
        {
            if (string.IsNullOrWhiteSpace(code.Value))
            {
                throw new InvalidOperationException(
                    $"Misconception code for answer '{answerChoiceId.Value}' in practice item '{practiceItem.Id.Value}' cannot be empty.");
            }

            if (!answerIds.Contains(answerChoiceId))
            {
                throw new InvalidOperationException(
                    $"Practice item '{practiceItem.Id.Value}' has a distractor entry for unknown answer '{answerChoiceId.Value}'.");
            }
        }

        foreach (AnswerChoiceId incorrectId in answerIds)
        {
            if (incorrectId == practiceItem.CorrectAnswerId)
            {
                continue;
            }

            if (!practiceItem.Distractors.ContainsKey(incorrectId))
            {
                throw new InvalidOperationException(
                    $"Practice item '{practiceItem.Id.Value}' has no distractor entry for answer '{incorrectId.Value}'.");
            }
        }

        if (practiceItem.Distractors.Count != answerIds.Count - 1)
        {
            throw new InvalidOperationException(
                $"Practice item '{practiceItem.Id.Value}' must contain a misconception for every incorrect answer.");
        }

        HashSet<MathObjectId> mathObjectIds = practiceItem.Mathematics.Objects
            .Select(value => value.Id)
            .ToHashSet();

        HashSet<AnswerChoiceId> boundAnswers = [];

        foreach (AnswerMathBinding binding in practiceItem.AnswerMathBindings)
        {
            if (!answerIds.Contains(binding.AnswerChoiceId))
            {
                throw new InvalidOperationException(
                    $"Practice item '{practiceItem.Id.Value}' has an answer-math binding for unknown answer '{binding.AnswerChoiceId.Value}'.");
            }

            if (!boundAnswers.Add(binding.AnswerChoiceId))
            {
                throw new InvalidOperationException(
                    $"Practice item '{practiceItem.Id.Value}' has duplicate answer-math binding for answer '{binding.AnswerChoiceId.Value}'.");
            }

            if (!mathObjectIds.Contains(binding.MathObjectId))
            {
                throw new InvalidOperationException(
                    $"Practice item '{practiceItem.Id.Value}' binds answer '{binding.AnswerChoiceId.Value}' to unknown math object '{binding.MathObjectId.Value}'.");
            }
        }

        if (boundAnswers.Count != answerIds.Count)
        {
            foreach (AnswerChoiceId answerId in answerIds)
            {
                if (!boundAnswers.Contains(answerId))
                {
                    throw new InvalidOperationException(
                        $"Practice item '{practiceItem.Id.Value}' is missing an answer-math binding for answer '{answerId.Value}'.");
                }
            }
        }
    }

    private static HashSet<T> EnsureUnique<T>(
        IEnumerable<T> values,
        Func<T, string> display,
        string kind)
        where T : notnull
    {
        HashSet<T> seen = [];

        foreach (T value in values)
        {
            if (!seen.Add(value))
            {
                throw new InvalidOperationException(
                    $"Duplicate {kind} id '{display(value)}'.");
            }
        }

        return seen;
    }
}
