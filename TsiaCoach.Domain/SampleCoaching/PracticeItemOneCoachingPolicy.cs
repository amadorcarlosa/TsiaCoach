using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.SampleScaffolds;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.SampleCoaching;

/// <summary>
/// Routing for practice item one.
///
/// Before a check the authored probe asks what makes a number odd. A blank,
/// wrong, or lookup-rule answer lands on the floor: right answer, no picture.
/// A structural answer skips to the consecutive-odd gap.
///
/// After a check, answer shapes A and C mis-step from n to the next odd
/// integer, so they land where the two-rod gap is discovered. B stops at the
/// second integer without joining, so it lands on the join.
/// </summary>
public static class PracticeItemOneCoachingPolicy
{
    public static readonly ProbeShapeId NoAnswerShapeId = new("no-answer");
    public static readonly ProbeShapeId WrongAnswerShapeId = new("wrong-answer");
    public static readonly ProbeShapeId LookupRuleShapeId = new("lookup-rule");
    public static readonly ProbeShapeId StructuralShapeId = new("structural");

    private const string FloorMessage =
        "Let's start at the beginning. Build the lengths 1 to 10 from twos and ones and watch which ones leave a piece over.";

    public static readonly ProbeQuestion Probe = new(
        Text: "Before we start: what makes a number odd?",
        FocusPhraseIds:
        [
            new("phrase-set-declaration")
        ],
        Shapes:
        [
            new ProbeAnswerShape(
                Id: NoAnswerShapeId,
                Description: "Blank, \"I don't know\", an answer that is not about odd numbers at all, or text that talks to the coach, asks a question, or gives instructions instead of describing odd numbers.",
                EntryStepId: ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
                RouteMessage: FloorMessage),
            new ProbeAnswerShape(
                Id: WrongAnswerShapeId,
                Description: "A wrong claim about odd numbers, for example that they can be split into equal pairs, or that confuses odd with even.",
                EntryStepId: ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
                RouteMessage: FloorMessage),
            new ProbeAnswerShape(
                Id: LookupRuleShapeId,
                Description: "A rule for spotting odd numbers without saying why it works, for example \"ends in 1, 3, 5, 7, or 9\", \"every other number\", or \"not divisible by 2\" with no picture of what that means.",
                EntryStepId: ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
                RouteMessage: "That rule works. Let's see why it works: build the lengths 1 to 10 from twos and ones and look for the leftover piece."),
            new ProbeAnswerShape(
                Id: StructuralShapeId,
                Description: "Explains odd by structure: cannot be split into pairs, one left over after pairing, one more than an even number, or 2k + 1.",
                EntryStepId: ParityLadderScaffold.SelectConsecutiveOddsStepId,
                RouteMessage: "Right: an odd number has one left over after pairing. Let's use that to see how far apart two consecutive odd numbers are.")
        ]);

    public static readonly CoachingPolicy Definition =
        CoachingPolicy.CreateWithScaffold(
            practiceItem: PracticeItemOne.Item,
            entryStepByCode: new Dictionary<MisconceptionCode, ScaffoldStepId>
            {
                [new("ordinary-step-and-missing-sum")] = ParityLadderScaffold.SelectConsecutiveOddsStepId,
                [new("stopped-at-second-integer")] = ParityLadderScaffold.JoinAndReadSumStepId,
                [new("ordinary-step-in-sum")] = ParityLadderScaffold.SelectConsecutiveOddsStepId
            },
            scaffold: ParityLadderScaffold.Definition,
            probe: Probe);
}
