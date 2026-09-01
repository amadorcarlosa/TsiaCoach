using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.SampleScaffolds;
using TsiaCoach.Domain.SampleCoaching;
using TsiaCoach.Domain.ScaffoldSessions;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.Scaffolds.Evaluation;
using TsiaCoach.Domain.Semantics;

namespace TsiaCoach.WebApi.Tests;

internal static class ScaffoldSessionTestData
{
    public static Attempt EscalatedRepresentationAttempt()
    {
        Attempt attempt = Attempt.Start(
            new AttemptId($"attempt-test-{Guid.NewGuid():N}"),
            PracticeItemOne.Item);

        attempt = AppendAttemptCheck(attempt, "answer-b", 0);
        return AppendAttemptCheck(attempt, "answer-b", 1);
    }

    public static Attempt AppendAttemptCheck(
        Attempt attempt,
        string answerId,
        int offset) =>
        attempt.Append(
            new CheckResultId($"attempt-check-test-{Guid.NewGuid():N}"),
            new AnswerChoiceId(answerId),
            DateTimeOffset.UnixEpoch.AddMinutes(offset),
            PracticeItemOne.Item);

    public static ScaffoldSessionGrant RepresentationGrant(
        Attempt? attempt = null)
    {
        attempt ??= EscalatedRepresentationAttempt();
        ScaffoldSessionAuthorization authorization =
            ScaffoldSessionAuthorizer.Authorize(
                attempt,
                PracticeItemOne.Item,
                PracticeItemOneCoachingPolicy.Definition);

        return authorization.Value as ScaffoldSessionGrant ??
            throw new InvalidOperationException("Expected an escalated scaffold grant.");
    }

    public static ScaffoldSession StartRepresentationSession(
        Attempt? attempt = null) =>
        ScaffoldSession.Start(
            new ScaffoldSessionId($"session-test-{Guid.NewGuid():N}"),
            RepresentationGrant(attempt),
            ParityLadderScaffold.Definition);

    public static ScaffoldStepSubmission IncorrectJoinSubmission() =>
        new JoinQuantitiesSubmission(
        [
            new SemanticQuantityReference(PracticeItemOne.N.Id)
        ]);

    public static ScaffoldStepSubmission CorrectJoinSubmission() =>
        new JoinQuantitiesSubmission(
        [
            new LatentExpressionReference(PracticeItemOne.SecondMember.Id),
            new SemanticQuantityReference(PracticeItemOne.N.Id)
        ]);

    public static ScaffoldSession CompleteRepresentationSession(
        ScaffoldSession? session = null)
    {
        session ??= StartRepresentationSession();
        DateTimeOffset checkedAt = DateTimeOffset.UnixEpoch;

        session = session.Append(
            NewCheckId(),
            CorrectJoinSubmission(),
            checkedAt,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);
        session = session.Append(
            NewCheckId(),
            new EnterScalarSubmission(2m),
            checkedAt,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);
        session = session.Append(
            NewCheckId(),
            new EnterScalarSubmission(2m),
            checkedAt,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);
        session = session.Append(
            NewCheckId(),
            CorrectJoinSubmission(),
            checkedAt,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);
        session = session.Append(
            NewCheckId(),
            new BuildExpressionSubmission(PracticeItemOne.RequestedValueComposed.MathObjectId),
            checkedAt,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);
        session = session.Append(
            NewCheckId(),
            new BuildExpressionSubmission(PracticeItemOne.RequestedValueSimplified.MathObjectId),
            checkedAt,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);
        return session.Append(
            NewCheckId(),
            new SelectAnswerChoiceSubmission(PracticeItemOne.Item.CorrectAnswerId),
            checkedAt,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);
    }

    public static ScaffoldCheckResultId NewCheckId() =>
        new($"session-check-test-{Guid.NewGuid():N}");
}
