using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Coaching;

public enum CoachingHintLevel
{
    Initial,
    Escalated
}

/// <summary>
/// Server-derived view of the latest incorrect check. <see cref="Purpose"/> is
/// the label of the authored entry step and is null when no scaffold exists.
/// </summary>
public sealed record CoachingDiagnosisProjection(
    AnswerChoiceId SelectedAnswerId,
    MisconceptionCode Misconception,
    ScaffoldPhasePurpose? Purpose,
    CoachingRoute Route,
    int RouteStreak,
    CoachingHintLevel HintLevel);
