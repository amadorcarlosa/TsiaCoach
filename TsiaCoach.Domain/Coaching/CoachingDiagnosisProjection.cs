using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Coaching;

public enum CoachingHintLevel
{
    Initial,
    Escalated
}

public sealed record CoachingDiagnosisProjection(
    AnswerChoiceId SelectedAnswerId,
    MisconceptionCode Misconception,
    ScaffoldPhasePurpose Purpose,
    CoachingRoute Route,
    int RouteStreak,
    CoachingHintLevel HintLevel);
