using System;
using TsiaCoach.Domain.PracticeItems;

namespace TsiaCoach.Domain.Attempts;

public sealed record CheckResult(
    CheckResultId Id,
    AnswerChoiceId SelectedAnswerId,
    DateTimeOffset CheckedAt);
