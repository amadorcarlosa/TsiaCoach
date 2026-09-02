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
using TsiaCoach.Domain.ValueObjects;

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

    public static ScaffoldSessionGrant GrantFor(Attempt attempt)
    {
        ScaffoldSessionAuthorization authorization =
            ScaffoldSessionAuthorizer.Authorize(
                attempt,
                PracticeItemOne.Item,
                PracticeItemOneCoachingPolicy.Definition);

        return authorization.Value as ScaffoldSessionGrant ??
            throw new InvalidOperationException("Expected a scaffold grant.");
    }

    /// <summary>Grant routed by two "stopped at second integer" checks: entry is the join step.</summary>
    public static ScaffoldSessionGrant RepresentationGrant(
        Attempt? attempt = null) =>
        GrantFor(attempt ?? EscalatedRepresentationAttempt());

    /// <summary>Grant before any check: entry is the floor of the path.</summary>
    public static ScaffoldSessionGrant FloorGrant() =>
        GrantFor(Attempt.Start(
            new AttemptId($"attempt-test-{Guid.NewGuid():N}"),
            PracticeItemOne.Item));

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

    public static ScaffoldStepSubmission CorrectClassificationSubmission() =>
        new ClassifyByFitSubmission(
            Enumerable.Range(1, 10)
                .Select(length => new FitClassificationEntry(
                    new UnitLength(length),
                    length % 2 == 0
                        ? FitClassification.Flush
                        : FitClassification.OneUnitLeftover))
                .ToArray());

    public static ScaffoldStepSubmission CorrectGapTraversalSubmission() =>
        new TraverseAllGapsSubmission(
        [
            new(new UnitLength(1), new UnitLength(3), ParityLadderScaffold.OddStepRodId),
            new(new UnitLength(3), new UnitLength(5), ParityLadderScaffold.OddStepRodId),
            new(new UnitLength(5), new UnitLength(7), ParityLadderScaffold.OddStepRodId),
            new(new UnitLength(7), new UnitLength(9), ParityLadderScaffold.OddStepRodId)
        ]);

    /// <summary>Submissions that satisfy the path from the join step to the end.</summary>
    public static IReadOnlyList<ScaffoldStepSubmission> RepresentationSubmissions() =>
    [
        CorrectJoinSubmission(),
        new EnterScalarSubmission(2m),
        new EnterScalarSubmission(2m)
    ];

    /// <summary>Submissions that satisfy the whole path from the floor.</summary>
    public static IReadOnlyList<ScaffoldStepSubmission> FullPathSubmissions() =>
    [
        CorrectClassificationSubmission(),
        new NameFitClassificationSubmission(IntegerDomain.OddIntegers),
        CorrectGapTraversalSubmission(),
        .. RepresentationSubmissions()
    ];

    public static ScaffoldSession CompleteRepresentationSession(
        ScaffoldSession? session = null)
    {
        session ??= StartRepresentationSession();
        DateTimeOffset checkedAt = DateTimeOffset.UnixEpoch;

        foreach (ScaffoldStepSubmission submission in RepresentationSubmissions())
        {
            session = session.Append(
                NewCheckId(),
                submission,
                checkedAt,
                PracticeItemOne.Item,
                ParityLadderScaffold.Definition);
        }

        return session;
    }

    public static ScaffoldCheckResultId NewCheckId() =>
        new($"session-check-test-{Guid.NewGuid():N}");
}
