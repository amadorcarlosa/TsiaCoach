using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.SampleScaffolds;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.SampleCoaching;

/// <summary>
/// Answer-shape routing for practice item one. A and C mis-step from n to the
/// next odd integer, so they land where the two-rod gap is discovered. B stops
/// at the second integer without joining, so it lands on the join.
/// </summary>
public static class PracticeItemOneCoachingPolicy
{
    public static readonly CoachingPolicy Definition =
        CoachingPolicy.CreateWithScaffold(
            practiceItem: PracticeItemOne.Item,
            entryStepByCode: new Dictionary<MisconceptionCode, ScaffoldStepId>
            {
                [new("ordinary-step-and-missing-sum")] = ParityLadderScaffold.SelectConsecutiveOddsStepId,
                [new("stopped-at-second-integer")] = ParityLadderScaffold.JoinAndReadSumStepId,
                [new("ordinary-step-in-sum")] = ParityLadderScaffold.SelectConsecutiveOddsStepId
            },
            scaffold: ParityLadderScaffold.Definition);
}
