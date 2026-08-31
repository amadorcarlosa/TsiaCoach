using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.Scaffolds;

namespace TsiaCoach.Domain.SampleCoaching;

public static class PracticeItemTwoCoachingPolicy
{
    public static readonly CoachingPolicy Definition =
        CoachingPolicy.CreateWithoutScaffold(
            practiceItem: PracticeItemTwo.Item,
            purposeByCode: new Dictionary<MisconceptionCode, ScaffoldPhasePurpose>
            {
                [new("this-year-resolved-as-w")] = ScaffoldPhasePurpose.LanguageInterpretation,
                [new("stopped-at-this-year")] = ScaffoldPhasePurpose.LanguageInterpretation,
                [new("scaled-variable-only")] = ScaffoldPhasePurpose.Representation
            });
}
