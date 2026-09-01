using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;

namespace TsiaCoach.WebApi.Attempts;

public enum AppendAttemptResultKind
{
    Appended,
    UnknownAttempt,
    ForeignAnswerChoice,
    AlreadyCorrect
}

public sealed record AppendAttemptResult(
    AppendAttemptResultKind Kind,
    Attempt? Attempt = null);

public sealed class InMemoryAttemptStore
{
    private readonly object sync = new();
    private readonly Dictionary<string, Attempt> attempts = new(StringComparer.Ordinal);
    private readonly TimeProvider timeProvider;

    public InMemoryAttemptStore(TimeProvider timeProvider)
    {
        this.timeProvider = timeProvider;
    }

    public Attempt Start(PracticeItem practiceItem)
    {
        lock (sync)
        {
            Attempt attempt;
            do
            {
                attempt = Attempt.Start(CreateAttemptId(), practiceItem);
            }
            while (attempts.ContainsKey(attempt.Id.Value));

            attempts.Add(attempt.Id.Value, attempt);
            return attempt;
        }
    }

    public bool TryGet(AttemptId attemptId, out Attempt attempt)
    {
        lock (sync)
        {
            return attempts.TryGetValue(attemptId.Value, out attempt!);
        }
    }

    public AppendAttemptResult Append(
        AttemptId attemptId,
        PracticeItem practiceItem,
        AnswerChoiceId selectedAnswerId)
    {
        lock (sync)
        {
            if (!attempts.TryGetValue(attemptId.Value, out Attempt? current))
            {
                return new(AppendAttemptResultKind.UnknownAttempt);
            }

            if (current.Phase(practiceItem).Value is AfterCorrectCheck)
            {
                return new(AppendAttemptResultKind.AlreadyCorrect, current);
            }

            if (!practiceItem.Answers.Any(answer => answer.Id == selectedAnswerId))
            {
                return new(AppendAttemptResultKind.ForeignAnswerChoice, current);
            }

            Attempt updated = current.Append(
                CreateCheckResultId(),
                selectedAnswerId,
                timeProvider.GetUtcNow(),
                practiceItem);
            attempts[attemptId.Value] = updated;
            return new(AppendAttemptResultKind.Appended, updated);
        }
    }

    private static AttemptId CreateAttemptId() =>
        new($"attempt-{Guid.NewGuid():N}");

    private static CheckResultId CreateCheckResultId() =>
        new($"check-{Guid.NewGuid():N}");
}
