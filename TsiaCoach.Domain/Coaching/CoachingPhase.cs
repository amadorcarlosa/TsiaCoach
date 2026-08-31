using TsiaCoach.Domain.PracticeItems;

namespace TsiaCoach.Domain.Coaching;

public sealed record BeforeCheck;

public sealed record AfterIncorrectCheck(
    AnswerChoiceId SelectedAnswerId,
    MisconceptionCode Misconception
);

public sealed record AfterCorrectCheck(
    AnswerChoiceId SelectedAnswerId
);

public union CoachingPhase(
    BeforeCheck,
    AfterIncorrectCheck,
    AfterCorrectCheck
);
