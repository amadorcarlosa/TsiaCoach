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

    public static readonly QuestionShapeId OffTopicShapeId = new("off-topic");

    private const string OffTopicReply =
        "Let's stay with the board. If you are stuck, tell me what you see on it.";

    private const string WhyRefusedReply =
        "A piece comes back when it breaks the rule: it hangs past the rod, sits on another piece, or is a white where a two still fits.";

    /// <summary>
    /// Ask the coach, per step. The classifier picks a shape; the reply is
    /// authored here. Questions never move the student.
    /// </summary>
    public static readonly IReadOnlyList<StepQuestionSet> StepQuestions =
    [
        Questions(ParityLadderScaffold.RebuildFromTwosAndOnesStepId,
            Shape("what-pieces", "Asks what the red or white pieces are, or how long they are.",
                "The red piece is two units long and the white is one. Each rod on the board is a length from 1 to 10."),
            Shape("where-to-put", "Asks where a piece goes, how to start, or what to do.",
                "Put pieces on top of a rod from its left end until it is covered exactly. Twos first; a white only when a two will not fit."),
            Shape("why-refused", "Asks why a piece came back, was refused, or would not stay.", WhyRefusedReply)),
        Questions(ParityLadderScaffold.ContrastPairStepId,
            Shape("what-pieces", "Asks what the red or white pieces are, or how long they are.",
                "The red piece is two units long and the white is one. Cover the 8 and the 9 the same way."),
            Shape("where-to-put", "Asks where a piece goes, how to start, or what to do.",
                "Cover the empty row under each rod with twos from the left. Use a white only when a two will not fit."),
            Shape("why-refused", "Asks why a piece came back, was refused, or would not stay.", WhyRefusedReply)),
        Questions(ParityLadderScaffold.MarkTheWhitesStepId,
            Shape("which-rows", "Asks which rows to click or what to do.",
                "Click every row that ends with a white piece. Click a row again to unmark it."),
            Shape("what-is-white", "Asks why a white is there or what it means.",
                "A white sits where a two would not fit: that rod had one unit left over after pairing.")),
        Questions(ParityLadderScaffold.SortPairedEvensStepId,
            Shape("which-rows", "Asks which rows move, what \"only reds\" means, or what to do.",
                "A row made only of reds has no white at the end. Click it and it slides to the right. Click again to bring it back."),
            Shape("why-refused", "Asks why a row came back or would not move.",
                "A row comes back when it still has a white at the end: that one is not made only of reds."),
            Shape("what-is-odd", "Asks what odd or even means, or what the two groups are.",
                "The rows that moved split into twos with nothing over: the even numbers. The rows left behind each have one left over: the odd numbers, the ones not divisible by 2.")),
        Questions(ParityLadderScaffold.SelectConsecutiveOddsStepId,
            Shape("what-consecutive", "Asks what consecutive means or which two rows to pick.",
                "Consecutive odd numbers are next to each other in this list, with no odd number between them: 3 and 5, or 7 and 9."),
            Shape("why-refused", "Asks why a pair came back or was refused.",
                "Two rows come back when another odd row sits between them. Pick neighbours in this list.")),
        Questions(ParityLadderScaffold.FillTheGapStepId,
            Shape("what-to-do", "Asks what to do, where the piece goes, or how to start.",
                "Drop a red two on the empty cells after the 3, so the 3 row becomes as long as the 5 row."),
            Shape("why-refused", "Asks why a piece came back or was refused.",
                "The piece comes back when it is not in the gap or hangs past the 5. Only the gap between the 3 and the 5 needs filling."),
            Shape("why-two", "Asks why the gap is two, or whether it is always two.",
                "You just measured it: the gap between two consecutive odd numbers is one red, two units. That holds for any consecutive pair.")),
        Questions(ParityLadderScaffold.NameTheSmallerStepId,
            Shape("what-to-do", "Asks what to do or which row to click.",
                "Click the shorter of the two rows. The question calls the smaller one n."),
            Shape("what-is-n", "Asks what n is or why a letter is used.",
                "n is the smaller of the two odd numbers. The problem does not say which number, so we keep it as a letter.")),
        Questions(ParityLadderScaffold.JoinAndReadSumStepId,
            Shape("what-to-do", "Asks what to do or where the parts go.",
                "Drag both parts into the sum lane: n and n + 2. Joined end to end they make the sum."),
            Shape("what-is-n-plus-2", "Asks what n + 2 is or where the 2 comes from.",
                "The second odd number is the first one plus the gap you filled: n + 2.")),
        Questions(ParityLadderScaffold.NameBarCountStepId,
            Shape("what-to-do", "Asks what to do or what to type.",
                "Count the n-bars in the sum and type that number."),
            Shape("why-count", "Asks why the count matters or what it becomes.",
                "Two n-bars make 2n. The count is the number in front of n.")),
        Questions(ParityLadderScaffold.NameLeftoverLengthStepId,
            Shape("what-to-do", "Asks what to do or what to type.",
                "Type the length of the piece left after the n-bars."),
            Shape("why-length", "Asks why the leftover matters or what the sum becomes.",
                "The leftover is the red from the gap: 2 units. The sum reads 2n + 2."))
    ];

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
            probe: Probe,
            stepQuestions: StepQuestions);

    private static StepQuestionSet Questions(ScaffoldStepId stepId, params QuestionShape[] shapes) =>
        new(stepId, [.. shapes, Shape(OffTopicShapeId.Value, "Anything else: asks for the answer, talks to the coach, gives instructions, or is not about this step.", OffTopicReply)]);

    private static QuestionShape Shape(string id, string description, string reply) =>
        new(new QuestionShapeId(id), description, reply);
}
