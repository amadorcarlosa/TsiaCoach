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

    public static ScaffoldSession StartFloorSession() =>
        ScaffoldSession.Start(
            new ScaffoldSessionId($"session-test-{Guid.NewGuid():N}"),
            FloorGrant(),
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

    /// <summary>Every row 1 to 10 rebuilt as floor(n / 2) reds then n mod 2 whites, from column 1.</summary>
    public static PlacePiecesSubmission CompleteRebuildSubmission() =>
        new(Enumerable.Range(1, 10)
            .SelectMany(n => ParityLadderScaffold.Composition(n, startX: 1, y: n))
            .Select(piece => new PlacedPiece(piece.Length, piece.X, piece.Y))
            .ToArray());

    public static ScaffoldStepSubmission SortEvensSubmission() =>
        new MoveRowsSubmission([2, 4, 6, 8, 10]);

    public static ScaffoldStepSubmission SelectThreeAndFiveSubmission() =>
        new SelectRowsSubmission([3, 5]);

    public static ScaffoldStepSubmission FillTheGapSubmission() =>
        new PlacePiecesSubmission([new PlacedPiece(2, 4, 3)]);

    public static ScaffoldStepSubmission NameTheSmallerSubmission() =>
        new SelectRowsSubmission([3]);

    /// <summary>Submissions that satisfy the path from the join step to the end.</summary>
    public static IReadOnlyList<ScaffoldStepSubmission> RepresentationSubmissions() =>
    [
        CorrectJoinSubmission(),
        new EnterScalarSubmission(2m),
        new EnterScalarSubmission(2m)
    ];

    /// <summary>Submissions that satisfy the whole path from the floor, skipping entry-only steps.</summary>
    public static IReadOnlyList<ScaffoldStepSubmission> FullPathSubmissions() =>
    [
        CompleteRebuildSubmission(),
        SortEvensSubmission(),
        SelectThreeAndFiveSubmission(),
        FillTheGapSubmission(),
        NameTheSmallerSubmission(),
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
