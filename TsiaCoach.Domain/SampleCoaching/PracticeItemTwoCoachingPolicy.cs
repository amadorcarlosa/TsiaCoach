using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.SampleQuestions;

namespace TsiaCoach.Domain.SampleCoaching;

public static class PracticeItemTwoCoachingPolicy
{
    public static readonly CoachingPolicy Definition =
        CoachingPolicy.CreateWithoutScaffold(PracticeItemTwo.Item);
}
