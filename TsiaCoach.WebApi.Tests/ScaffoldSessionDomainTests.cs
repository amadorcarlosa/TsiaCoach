using System.Reflection;

using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.SampleCoaching;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.SampleScaffolds;
using TsiaCoach.Domain.ScaffoldSessions;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.Scaffolds.Evaluation;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.WebApi.Tests;

public sealed class ScaffoldSessionDomainTests
{
    [Test]
    public async Task BeforeCheck_GrantsFloorEntry()
    {
        Attempt attempt = Attempt.Start(new("attempt-before-check"), PracticeItemOne.Item);

        ScaffoldSessionGrant grant = Grant(attempt);

        await Assert.That(grant.AuthorizedByCheckResultId).IsNull();
        await Assert.That(grant.EntryStepId)
            .IsEqualTo(ParityLadderScaffold.RebuildFromTwosAndOnesStepId);
    }

    [Test]
    public async Task ProbeRoute_DecidesEntryBeforeCheck()
    {
        Attempt attempt = Attempt.Start(new("attempt-probed"), PracticeItemOne.Item);
        ProbeRoute route = new(
            attempt.Id,
            PracticeItemOneCoachingPolicy.StructuralShapeId,
            ParityLadderScaffold.SelectConsecutiveOddsStepId,
            DateTimeOffset.UnixEpoch);

        ScaffoldSessionGrant grant = Grant(attempt, route);

        await Assert.That(grant.AuthorizedByCheckResultId).IsNull();
        await Assert.That(grant.EntryStepId)
            .IsEqualTo(ParityLadderScaffold.SelectConsecutiveOddsStepId);
    }

    [Test]
    public async Task ProbeRoute_IsRederivedFromTheAuthoredShape()
    {
        Attempt attempt = Attempt.Start(new("attempt-probed-tamper"), PracticeItemOne.Item);
        ProbeRoute tampered = new(
            attempt.Id,
            PracticeItemOneCoachingPolicy.LookupRuleShapeId,
            ParityLadderScaffold.NameLeftoverLengthStepId,
            DateTimeOffset.UnixEpoch);

        ScaffoldSessionGrant grant = Grant(attempt, tampered);

        await Assert.That(grant.EntryStepId)
            .IsEqualTo(ParityLadderScaffold.RebuildFromTwosAndOnesStepId);
    }

    [Test]
    public async Task ProbeRoute_IsIgnoredAfterIncorrectCheck()
    {
        Attempt attempt = ScaffoldSessionTestData.AppendAttemptCheck(
            Attempt.Start(new("attempt-probed-then-wrong"), PracticeItemOne.Item),
            "answer-b",
            0);
        ProbeRoute route = new(
            attempt.Id,
            PracticeItemOneCoachingPolicy.StructuralShapeId,
            ParityLadderScaffold.SelectConsecutiveOddsStepId,
            DateTimeOffset.UnixEpoch);

        ScaffoldSessionGrant grant = Grant(attempt, route);

        await Assert.That(grant.EntryStepId)
            .IsEqualTo(ParityLadderScaffold.JoinAndReadSumStepId);
    }

    [Test]
    public async Task ProbeRoute_ForAnotherAttemptIsRejected()
    {
        Attempt attempt = Attempt.Start(new("attempt-probed-own"), PracticeItemOne.Item);
        ProbeRoute foreign = new(
            new AttemptId("attempt-someone-else"),
            PracticeItemOneCoachingPolicy.StructuralShapeId,
            ParityLadderScaffold.SelectConsecutiveOddsStepId,
            DateTimeOffset.UnixEpoch);

        await AssertInvalid(() => _ = ScaffoldSessionAuthorizer.Authorize(
            attempt,
            PracticeItemOne.Item,
            PracticeItemOneCoachingPolicy.Definition,
            foreign));
    }

    [Test]
    public async Task FirstIncorrectCheck_GrantsRoutedEntry()
    {
        Attempt attempt = ScaffoldSessionTestData.AppendAttemptCheck(
            Attempt.Start(new("attempt-initial"), PracticeItemOne.Item),
            "answer-b",
            0);

        ScaffoldSessionGrant grant = Grant(attempt);

        await Assert.That(grant.AuthorizedByCheckResultId)
            .IsEqualTo(attempt.Checks[^1].Id);
        await Assert.That(grant.EntryStepId)
            .IsEqualTo(ParityLadderScaffold.JoinAndReadSumStepId);
    }

    [Test]
    public async Task SecondSameRouteIncorrectCheck_GrantsSameEntry()
    {
        Attempt attempt = ScaffoldSessionTestData.EscalatedRepresentationAttempt();
        ScaffoldSessionGrant grant = Grant(attempt);

        await Assert.That(grant.AuthorizedByCheckResultId)
            .IsEqualTo(attempt.Checks[^1].Id);
        await Assert.That(grant.ScaffoldId)
            .IsEqualTo(ParityLadderScaffold.Definition.Id);
        await Assert.That(grant.EntryStepId)
            .IsEqualTo(ParityLadderScaffold.JoinAndReadSumStepId);
    }

    [Test]
    public async Task LatestIncorrectCheck_DecidesTheEntry()
    {
        Attempt attempt = Attempt.Start(new("attempt-latest"), PracticeItemOne.Item);
        attempt = ScaffoldSessionTestData.AppendAttemptCheck(attempt, "answer-b", 0);
        attempt = ScaffoldSessionTestData.AppendAttemptCheck(attempt, "answer-a", 1);

        ScaffoldSessionGrant grant = Grant(attempt);

        await Assert.That(grant.EntryStepId)
            .IsEqualTo(ParityLadderScaffold.SelectConsecutiveOddsStepId);
    }

    [Test]
    public async Task CorrectAttempt_GrantsFloorEntry()
    {
        Attempt attempt = Attempt.Start(new("attempt-correct"), PracticeItemOne.Item)
            .Append(
                new CheckResultId("check-correct"),
                PracticeItemOne.Item.CorrectAnswerId,
                DateTimeOffset.UnixEpoch,
                PracticeItemOne.Item);

        ScaffoldSessionGrant grant = Grant(attempt);

        await Assert.That(grant.AuthorizedByCheckResultId)
            .IsEqualTo(attempt.Checks[^1].Id);
        await Assert.That(grant.EntryStepId)
            .IsEqualTo(ParityLadderScaffold.RebuildFromTwosAndOnesStepId);
    }

    [Test]
    public async Task NoScaffoldAuthored_DeniesScaffoldSession()
    {
        Attempt attempt = Attempt.Start(new("attempt-no-scaffold"), PracticeItemTwo.Item);

        ScaffoldSessionAuthorization beforeCheck = Authorize(
            attempt,
            PracticeItemTwo.Item,
            PracticeItemTwoCoachingPolicy.Definition);

        attempt = attempt.Append(
            new CheckResultId("check-two-1"),
            new AnswerChoiceId("answer-b"),
            DateTimeOffset.UnixEpoch,
            PracticeItemTwo.Item);

        ScaffoldSessionAuthorization afterCheck = Authorize(
            attempt,
            PracticeItemTwo.Item,
            PracticeItemTwoCoachingPolicy.Definition);

        await Assert.That(Denied(beforeCheck).Reason)
            .IsEqualTo(ScaffoldSessionDenialReason.NoScaffoldAuthored);
        await Assert.That(Denied(afterCheck).Reason)
            .IsEqualTo(ScaffoldSessionDenialReason.NoScaffoldAuthored);
    }

    [Test]
    public async Task Grant_PinsLatestAttemptCheckAndServerRoute()
    {
        Attempt attempt = ScaffoldSessionTestData.EscalatedRepresentationAttempt();
        ScaffoldSessionGrant grant = Grant(attempt);

        await Assert.That(grant.AttemptId).IsEqualTo(attempt.Id);
        await Assert.That(grant.AuthorizedByCheckResultId)
            .IsEqualTo(attempt.Checks[^1].Id);
        await Assert.That(grant.PracticeItemId).IsEqualTo(PracticeItemOne.Id);
        await Assert.That(grant.ScaffoldId)
            .IsEqualTo(ParityLadderScaffold.Definition.Id);
        await Assert.That(grant.EntryStepId)
            .IsEqualTo(ParityLadderScaffold.JoinAndReadSumStepId);
    }

    [Test]
    public async Task Start_PinsGrantAndBeginsAtEntryStep()
    {
        Attempt attempt = ScaffoldSessionTestData.EscalatedRepresentationAttempt();
        ScaffoldSessionGrant grant = Grant(attempt);
        ScaffoldSession session = ScaffoldSession.Start(
            new ScaffoldSessionId("session-start"),
            grant,
            ParityLadderScaffold.Definition);
        ActiveScaffoldSession progress = Active(session.Progress(
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition));

        await Assert.That(session.AttemptId).IsEqualTo(grant.AttemptId);
        await Assert.That(session.AuthorizedByCheckResultId)
            .IsEqualTo(grant.AuthorizedByCheckResultId);
        await Assert.That(session.EntryStepId)
            .IsEqualTo(ParityLadderScaffold.JoinAndReadSumStepId);
        await Assert.That(progress.CurrentStepId)
            .IsEqualTo(session.EntryStepId);
        await Assert.That(progress.CompletedStepCount).IsEqualTo(0);
        await Assert.That(progress.TotalStepCount).IsEqualTo(3);
    }

    [Test]
    public async Task Start_AtFloorTraversesTheWholePath()
    {
        ScaffoldSession session = ScaffoldSession.Start(
            new ScaffoldSessionId("session-floor"),
            ScaffoldSessionTestData.FloorGrant(),
            ParityLadderScaffold.Definition);
        ActiveScaffoldSession progress = Active(session.Progress(
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition));

        await Assert.That(progress.CurrentStepId)
            .IsEqualTo(ParityLadderScaffold.RebuildFromTwosAndOnesStepId);
        await Assert.That(progress.TotalStepCount).IsEqualTo(8);
    }

    [Test]
    public async Task AnyStep_CanBeAnEntry()
    {
        foreach (ScaffoldStep step in ParityLadderScaffold.Definition.Steps)
        {
            ScaffoldSessionGrant grant = ScaffoldSessionTestData.FloorGrant() with
            {
                EntryStepId = step.Id
            };

            ScaffoldSession session = ScaffoldSession.Start(
                new ScaffoldSessionId($"session-entry-{step.Id.Value}"),
                grant,
                ParityLadderScaffold.Definition);
            ActiveScaffoldSession progress = Active(session.Progress(
                PracticeItemOne.Item,
                ParityLadderScaffold.Definition));

            await Assert.That(progress.CurrentStepId).IsEqualTo(step.Id);
            await Assert.That(progress.TotalStepCount)
                .IsEqualTo(ParityLadderScaffold.Definition.PathFrom(step.Id).Count);
        }
    }

    [Test]
    public async Task Start_RejectsForeignScaffold()
    {
        ScaffoldSessionGrant grant = Grant();
        Scaffold foreign = new(
            new ScaffoldId("foreign-scaffold"),
            PracticeItemOne.Id,
            [],
            []);

        await AssertInvalid(() => ScaffoldSession.Start(
            new("session-foreign-scaffold"),
            grant,
            foreign));
    }

    [Test]
    public async Task Start_RejectsEntryNotOnThePath()
    {
        ScaffoldSessionGrant grant = Grant() with
        {
            EntryStepId = new ScaffoldStepId("step-not-on-path")
        };

        await AssertInvalid(() => ScaffoldSession.Start(
            new("session-unknown-entry"),
            grant,
            ParityLadderScaffold.Definition));
    }

    [Test]
    public async Task IncorrectSubmission_AppendsFactAndKeepsCurrentStep()
    {
        ScaffoldSession session = ScaffoldSessionTestData.StartRepresentationSession();
        ScaffoldSession updated = session.Append(
            ScaffoldSessionTestData.NewCheckId(),
            ScaffoldSessionTestData.IncorrectJoinSubmission(),
            DateTimeOffset.UnixEpoch,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);

        ActiveScaffoldSession progress = Active(updated.Progress(
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition));

        await Assert.That(updated.Checks.Count).IsEqualTo(1);
        await Assert.That(progress.CurrentStepId)
            .IsEqualTo(ParityLadderScaffold.JoinAndReadSumStepId);
        await Assert.That(progress.CompletedStepCount).IsEqualTo(0);
    }

    [Test]
    public async Task SatisfiedSubmission_AppendsFactAndAdvances()
    {
        ScaffoldSession session = ScaffoldSessionTestData.StartRepresentationSession();
        ScaffoldSession updated = session.Append(
            ScaffoldSessionTestData.NewCheckId(),
            ScaffoldSessionTestData.CorrectJoinSubmission(),
            DateTimeOffset.UnixEpoch,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);

        ActiveScaffoldSession progress = Active(updated.Progress(
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition));

        await Assert.That(progress.CurrentStepId)
            .IsEqualTo(ParityLadderScaffold.NameBarCountStepId);
        await Assert.That(progress.CompletedStepCount).IsEqualTo(1);
    }

    [Test]
    public async Task SatisfiedFinalStep_CompletesSession()
    {
        ScaffoldSession session = ScaffoldSessionTestData.CompleteRepresentationSession();

        await Assert.That(session.Progress(
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition).Value)
            .IsTypeOf<CompletedScaffoldSession>();
    }

    [Test]
    public async Task FloorSession_CompletesAfterTheWholePath()
    {
        ScaffoldSession session = ScaffoldSession.Start(
            new ScaffoldSessionId("session-floor-complete"),
            ScaffoldSessionTestData.FloorGrant(),
            ParityLadderScaffold.Definition);

        foreach (ScaffoldStepSubmission submission in ScaffoldSessionTestData.FullPathSubmissions())
        {
            session = session.Append(
                ScaffoldSessionTestData.NewCheckId(),
                submission,
                DateTimeOffset.UnixEpoch,
                PracticeItemOne.Item,
                ParityLadderScaffold.Definition);
        }

        await Assert.That(session.Checks.Count).IsEqualTo(8);
        await Assert.That(session.Progress(
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition).Value)
            .IsTypeOf<CompletedScaffoldSession>();
    }

    [Test]
    public async Task AcceptedSubmission_BecomesEvidenceAndRejectedDoesNot()
    {
        ScaffoldSession session = ScaffoldSessionTestData.StartFloorSession();

        await Assert.That(session.CurrentStepEvidence(PracticeItemOne.Item, ParityLadderScaffold.Definition))
            .IsNull();

        session = session.Append(
            ScaffoldSessionTestData.NewCheckId(),
            new PlacePiecesSubmission([new PlacedPiece(2, 1, 4)]),
            DateTimeOffset.UnixEpoch,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);
        ScaffoldStepSubmission? accepted = session.CurrentStepEvidence(PracticeItemOne.Item, ParityLadderScaffold.Definition);
        await Assert.That(accepted?.Value).IsTypeOf<PlacePiecesSubmission>();

        session = session.Append(
            ScaffoldSessionTestData.NewCheckId(),
            new PlacePiecesSubmission([new PlacedPiece(1, 1, 4)]),
            DateTimeOffset.UnixEpoch,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);
        ScaffoldStepSubmission? afterRejected = session.CurrentStepEvidence(PracticeItemOne.Item, ParityLadderScaffold.Definition);
        await Assert.That(afterRejected).IsEqualTo(accepted);
        await Assert.That(Active(session.Progress(PracticeItemOne.Item, ParityLadderScaffold.Definition)).CompletedStepCount)
            .IsEqualTo(0);

        session = session.Append(
            ScaffoldSessionTestData.NewCheckId(),
            ScaffoldSessionTestData.CompleteRebuildSubmission(),
            DateTimeOffset.UnixEpoch,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);
        await Assert.That(session.CurrentStepEvidence(PracticeItemOne.Item, ParityLadderScaffold.Definition))
            .IsNull();
        await Assert.That(Active(session.Progress(PracticeItemOne.Item, ParityLadderScaffold.Definition)).CurrentStepId)
            .IsEqualTo(ParityLadderScaffold.SortPairedEvensStepId);
    }

    [Test]
    public async Task AppendAfterCompletion_IsRejected()
    {
        ScaffoldSession session = ScaffoldSessionTestData.CompleteRepresentationSession();

        await AssertInvalid(() => session.Append(
            ScaffoldSessionTestData.NewCheckId(),
            new EnterScalarSubmission(2m),
            DateTimeOffset.UnixEpoch,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition));
    }

    [Test]
    public async Task Append_RejectsForeignPracticeItem()
    {
        await AssertInvalid(() => ScaffoldSessionTestData.StartRepresentationSession().Append(
            ScaffoldSessionTestData.NewCheckId(),
            ScaffoldSessionTestData.CorrectJoinSubmission(),
            DateTimeOffset.UnixEpoch,
            PracticeItemTwo.Item,
            ParityLadderScaffold.Definition));
    }

    [Test]
    public async Task Append_RejectsForeignScaffold()
    {
        Scaffold foreign = new(
            new ScaffoldId("foreign-scaffold-append"),
            PracticeItemOne.Id,
            [],
            []);

        await AssertInvalid(() => ScaffoldSessionTestData.StartRepresentationSession().Append(
            ScaffoldSessionTestData.NewCheckId(),
            ScaffoldSessionTestData.CorrectJoinSubmission(),
            DateTimeOffset.UnixEpoch,
            PracticeItemOne.Item,
            foreign));
    }

    [Test]
    public async Task Append_RejectsDuplicateCheckResultId()
    {
        ScaffoldSession session = ScaffoldSessionTestData.StartRepresentationSession();
        ScaffoldCheckResultId checkId = ScaffoldSessionTestData.NewCheckId();
        session = session.Append(
            checkId,
            ScaffoldSessionTestData.IncorrectJoinSubmission(),
            DateTimeOffset.UnixEpoch,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);

        ScaffoldSession current = session;
        await AssertInvalid(() => current.Append(
            checkId,
            ScaffoldSessionTestData.IncorrectJoinSubmission(),
            DateTimeOffset.UnixEpoch,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition));
    }

    [Test]
    public async Task Append_RejectsEarlierTimestamp()
    {
        ScaffoldSession session = ScaffoldSessionTestData.StartRepresentationSession()
            .Append(
                ScaffoldSessionTestData.NewCheckId(),
                ScaffoldSessionTestData.IncorrectJoinSubmission(),
                DateTimeOffset.UnixEpoch.AddMinutes(1),
                PracticeItemOne.Item,
                ParityLadderScaffold.Definition);

        await AssertInvalid(() => session.Append(
            ScaffoldSessionTestData.NewCheckId(),
            ScaffoldSessionTestData.IncorrectJoinSubmission(),
            DateTimeOffset.UnixEpoch,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition));
    }

    [Test]
    public async Task EqualTimestamp_IsAllowed()
    {
        ScaffoldSession session = ScaffoldSessionTestData.StartRepresentationSession();
        DateTimeOffset checkedAt = DateTimeOffset.UnixEpoch;
        session = session.Append(
            ScaffoldSessionTestData.NewCheckId(),
            ScaffoldSessionTestData.IncorrectJoinSubmission(),
            checkedAt,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);
        session = session.Append(
            ScaffoldSessionTestData.NewCheckId(),
            ScaffoldSessionTestData.IncorrectJoinSubmission(),
            checkedAt,
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);

        await Assert.That(session.Checks.Count).IsEqualTo(2);
    }

    [Test]
    public async Task Checks_AreImmutableAndContainFactsOnly()
    {
        ScaffoldSession session = ScaffoldSessionTestData.StartRepresentationSession()
            .Append(
                ScaffoldSessionTestData.NewCheckId(),
                ScaffoldSessionTestData.IncorrectJoinSubmission(),
                DateTimeOffset.UnixEpoch,
                PracticeItemOne.Item,
                ParityLadderScaffold.Definition);

        await Assert.That(((IList<ScaffoldCheckResult>)session.Checks).IsReadOnly)
            .IsTrue();
        await Assert.That(typeof(ScaffoldCheckResult).GetProperty("Satisfied"))
            .IsNull();
        await Assert.That(typeof(ScaffoldCheckResult).GetProperty("ExpectedValueId"))
            .IsNull();
        await Assert.That(session.Checks[0].Submission.Value)
            .IsTypeOf<JoinQuantitiesSubmission>();
    }

    [Test]
    public async Task SessionCreation_IsDomainControlled()
    {
        await Assert.That(typeof(ScaffoldSession)
                .GetConstructors(BindingFlags.Public | BindingFlags.Instance)
                .Length)
            .IsEqualTo(0);
    }

    [Test]
    public async Task Progress_ReplaysHistoryWithoutStoredOutcomes()
    {
        ScaffoldSession session = ScaffoldSessionTestData.StartRepresentationSession()
            .Append(
                ScaffoldSessionTestData.NewCheckId(),
                ScaffoldSessionTestData.IncorrectJoinSubmission(),
                DateTimeOffset.UnixEpoch,
                PracticeItemOne.Item,
                ParityLadderScaffold.Definition);

        ActiveScaffoldSession progress = Active(session.Progress(
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition));

        await Assert.That(progress.CurrentStepId)
            .IsEqualTo(ParityLadderScaffold.JoinAndReadSumStepId);
        await Assert.That(session.Checks[0].GetType().GetProperty("Satisfied"))
            .IsNull();
    }

    [Test]
    public async Task Session_OnlyTraversesStepsAtOrAfterEntry()
    {
        ScaffoldSession session = ScaffoldSessionTestData.StartRepresentationSession();
        ActiveScaffoldSession progress = Active(session.Progress(
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition));
        string[] authorizedIds = ParityLadderScaffold.Definition.Steps
            .SkipWhile(step => step.Id != session.EntryStepId)
            .Select(step => step.Id.Value)
            .ToArray();

        await Assert.That(progress.TotalStepCount).IsEqualTo(authorizedIds.Length);
        await Assert.That(authorizedIds[0])
            .IsEqualTo(ParityLadderScaffold.JoinAndReadSumStepId.Value);
        await Assert.That(progress.CurrentStepId.Value)
            .IsEqualTo(authorizedIds[0]);
    }

    private static ScaffoldSessionAuthorization Authorize(
        Attempt attempt,
        PracticeItem item,
        CoachingPolicy? policy = null) =>
        ScaffoldSessionAuthorizer.Authorize(
            attempt,
            item,
            policy ?? PracticeItemOneCoachingPolicy.Definition);

    private static ScaffoldSessionGrant Grant(
        Attempt? attempt = null,
        ProbeRoute? probeRoute = null) =>
        ScaffoldSessionAuthorizer.Authorize(
            attempt ?? ScaffoldSessionTestData.EscalatedRepresentationAttempt(),
            PracticeItemOne.Item,
            PracticeItemOneCoachingPolicy.Definition,
            probeRoute).Value as ScaffoldSessionGrant
        ?? throw new InvalidOperationException("Expected scaffold grant.");

    private static ScaffoldSessionDenied Denied(
        ScaffoldSessionAuthorization authorization) =>
        authorization.Value as ScaffoldSessionDenied
        ?? throw new InvalidOperationException("Expected scaffold denial.");

    private static ActiveScaffoldSession Active(
        ScaffoldSessionProgress progress) =>
        progress.Value as ActiveScaffoldSession
        ?? throw new InvalidOperationException("Expected active scaffold session.");

    private static async Task AssertInvalid(Action action)
    {
        InvalidOperationException? exception = null;
        try
        {
            action();
        }
        catch (InvalidOperationException caught)
        {
            exception = caught;
        }

        await Assert.That(exception is not null).IsTrue();
    }
}
