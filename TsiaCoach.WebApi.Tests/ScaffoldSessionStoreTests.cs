using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.SampleScaffolds;
using TsiaCoach.Domain.ScaffoldSessions;
using TsiaCoach.Domain.Scaffolds.Evaluation;
using TsiaCoach.WebApi.ScaffoldSessions;

namespace TsiaCoach.WebApi.Tests;

public sealed class ScaffoldSessionStoreTests
{
    [Test]
    public async Task Start_DeduplicatesSameAttemptAndRoute()
    {
        InMemoryScaffoldSessionStore store = CreateStore();
        ScaffoldSessionGrant grant = ScaffoldSessionTestData.RepresentationGrant();

        ScaffoldSessionStartResult first = store.Start(
            grant,
            ParityLadderScaffold.Definition);
        ScaffoldSessionStartResult second = store.Start(
            grant,
            ParityLadderScaffold.Definition);

        await Assert.That(first.Kind)
            .IsEqualTo(ScaffoldSessionStartResultKind.Created);
        await Assert.That(second.Kind)
            .IsEqualTo(ScaffoldSessionStartResultKind.Existing);
        await Assert.That(second.Session.Id).IsEqualTo(first.Session.Id);
    }

    [Test]
    public async Task ConcurrentStart_ReturnsSingleSession()
    {
        InMemoryScaffoldSessionStore store = CreateStore();
        ScaffoldSessionGrant grant = ScaffoldSessionTestData.RepresentationGrant();

        ScaffoldSessionStartResult[] results = await Task.WhenAll(
            Enumerable.Range(0, 16)
                .Select(_ => Task.Run(() => store.Start(
                    grant,
                    ParityLadderScaffold.Definition))));

        await Assert.That(results.Count(result =>
                result.Kind == ScaffoldSessionStartResultKind.Created))
            .IsEqualTo(1);
        await Assert.That(results.Select(result => result.Session.Id).Distinct().Count())
            .IsEqualTo(1);
    }

    [Test]
    public async Task ConcurrentIncorrectChecks_DoNotLoseHistory()
    {
        InMemoryScaffoldSessionStore store = CreateStore();
        ScaffoldSessionStartResult started = store.Start(
            ScaffoldSessionTestData.RepresentationGrant(),
            ParityLadderScaffold.Definition);

        ScaffoldSessionAppendResult[] results = await Task.WhenAll(
            Enumerable.Range(0, 8)
                .Select(_ => Task.Run(() => store.Append(
                    started.Session.Id,
                    ScaffoldSessionTestData.IncorrectJoinSubmission(),
                    PracticeItemOne.Item,
                    ParityLadderScaffold.Definition))));

        await Assert.That(results.All(result =>
                result.Kind == ScaffoldSessionAppendResultKind.Appended))
            .IsTrue();
        await Assert.That(store.TryGet(started.Session.Id, out ScaffoldSession? latest))
            .IsTrue();
        await Assert.That(latest!.Checks.Count).IsEqualTo(8);
    }

    [Test]
    public async Task Read_ReturnsLatestImmutableSession()
    {
        InMemoryScaffoldSessionStore store = CreateStore();
        ScaffoldSessionStartResult started = store.Start(
            ScaffoldSessionTestData.RepresentationGrant(),
            ParityLadderScaffold.Definition);
        _ = store.Append(
            started.Session.Id,
            ScaffoldSessionTestData.IncorrectJoinSubmission(),
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);

        await Assert.That(started.Session.Checks.Count).IsEqualTo(0);
        await Assert.That(store.TryGet(started.Session.Id, out ScaffoldSession? latest))
            .IsTrue();
        await Assert.That(latest!.Checks.Count).IsEqualTo(1);
        await Assert.That(latest).IsNotEqualTo(started.Session);
    }

    [Test]
    public async Task InvalidSubmission_DoesNotAppendHistory()
    {
        InMemoryScaffoldSessionStore store = CreateStore();
        ScaffoldSessionStartResult started = store.Start(
            ScaffoldSessionTestData.RepresentationGrant(),
            ParityLadderScaffold.Definition);

        ScaffoldSessionAppendResult result = store.Append(
            started.Session.Id,
            new EnterScalarSubmission(2m),
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);

        await Assert.That(result.Kind)
            .IsEqualTo(ScaffoldSessionAppendResultKind.InvalidSubmission);
        await Assert.That(store.TryGet(started.Session.Id, out ScaffoldSession? latest))
            .IsTrue();
        await Assert.That(latest!.Checks.Count).IsEqualTo(0);
    }

    [Test]
    public async Task CompletedSession_DoesNotAppendHistory()
    {
        InMemoryScaffoldSessionStore store = CreateStore();
        ScaffoldSession completed = ScaffoldSessionTestData.CompleteRepresentationSession();
        ScaffoldSessionStartResult started = store.Start(
            ScaffoldSessionTestData.RepresentationGrant(),
            ParityLadderScaffold.Definition);

        foreach (ScaffoldCheckResult check in completed.Checks)
        {
            ScaffoldSessionAppendResult result = store.Append(
                started.Session.Id,
                check.Submission,
                PracticeItemOne.Item,
                ParityLadderScaffold.Definition);
            await Assert.That(result.Kind)
                .IsEqualTo(ScaffoldSessionAppendResultKind.Appended);
        }

        ScaffoldSessionAppendResult afterCompletion = store.Append(
            started.Session.Id,
            new EnterScalarSubmission(2m),
            PracticeItemOne.Item,
            ParityLadderScaffold.Definition);

        await Assert.That(afterCompletion.Kind)
            .IsEqualTo(ScaffoldSessionAppendResultKind.Completed);
        await Assert.That(store.TryGet(started.Session.Id, out ScaffoldSession? latest))
            .IsTrue();
        await Assert.That(latest!.Checks.Count).IsEqualTo(3);
    }

    private static InMemoryScaffoldSessionStore CreateStore() =>
        new(TimeProvider.System);
}
