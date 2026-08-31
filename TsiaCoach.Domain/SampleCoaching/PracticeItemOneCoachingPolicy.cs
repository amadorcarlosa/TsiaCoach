using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.SampleScaffolds;
using TsiaCoach.Domain.Scaffolds;

namespace TsiaCoach.Domain.SampleCoaching;

public static class PracticeItemOneCoachingPolicy
{
    public static readonly CoachingPolicy Definition =
        CoachingPolicy.CreateWithScaffold(
            practiceItem: PracticeItemOne.Item,
            purposeByCode: new Dictionary<MisconceptionCode, ScaffoldPhasePurpose>
            {
                [new("ordinary-step-and-missing-sum")] = ScaffoldPhasePurpose.LanguageInterpretation,
                [new("stopped-at-second-integer")] = ScaffoldPhasePurpose.Representation,
                [new("ordinary-step-in-sum")] = ScaffoldPhasePurpose.LanguageInterpretation
            },
            scaffold: ParityLadderScaffold.Definition);
}
