using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using TsiaCoach.WebApi.Agents;
using TsiaCoach.WebApi.CoachingAgents;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

public sealed class CoachingMoveRecorderTests : CoachApiTestBase
{
    [Test]
    public async Task SuccessfulTurn_RecordsValidatedMove()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);
        Runner.Result = CoachingAgentRunResult.FromText(AskJson());

        using HttpResponseMessage response = await Coach(
            client,
            attempt.AttemptId,
            """{ "event": "helpRequested" }""");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        IReadOnlyList<CoachingMoveRecord> records = Recorder.Snapshot();
        await Assert.That(records.Count).IsEqualTo(1);
        await Assert.That(records[0].MoveKind)
            .IsEqualTo(CoachContractNames.AskReadingQuestion);
    }

    [Test]
    public async Task RecordedMove_ContainsServerDerivedAttemptFacts()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);
        await CheckAttempt(client, attempt.AttemptId, "answer-b");
        Runner.Result = CoachingAgentRunResult.FromText(DiagnoseJson());

        using HttpResponseMessage response = await Coach(
            client,
            attempt.AttemptId,
            """{ "event": "diagnosisRequested" }""");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        CoachingMoveRecord record = Recorder.Snapshot().Single();
        await Assert.That(record.RecordId).IsNotEmpty();
        await Assert.That(record.AttemptId).IsEqualTo(attempt.AttemptId);
        await Assert.That(record.PracticeItemId)
            .IsEqualTo("practice-item-sample-1");
        await Assert.That(record.CheckCount).IsEqualTo(1);
        await Assert.That(record.Phase)
            .IsEqualTo(CoachContractNames.AfterIncorrectCheck);
        await Assert.That(record.RequestedEvent)
            .IsEqualTo(CoachContractNames.DiagnosisRequested);
        await Assert.That(record.MoveKind)
            .IsEqualTo(CoachContractNames.DiagnoseDifference);
        await Assert.That(record.FocusPhraseIds).IsEquivalentTo(
            new[] { "phrase-target" });
        await Assert.That(record.SuggestedStepId).IsNull();
        await Assert.That(record.ProvenanceFactIds).IsEmpty();
        await Assert.That(record.RecordedAt)
            .IsNotEqualTo(default(DateTimeOffset));
    }

    [Test]
    public async Task RecordedMove_DoesNotContainRawModelOutputOrInstructions()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);
        Runner.Result = CoachingAgentRunResult.FromText(AskJson());

        using HttpResponseMessage response = await Coach(
            client,
            attempt.AttemptId,
            """{ "event": "helpRequested" }""");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        CoachingMoveRecord record = Recorder.Snapshot().Single();

        string[] propertyNames = typeof(CoachingMoveRecord)
            .GetProperties()
            .Select(property => property.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();
        await Assert.That(propertyNames).IsEquivalentTo(
            new[]
            {
                "AttemptId",
                "CheckCount",
                "FocusPhraseIds",
                "MoveKind",
                "Phase",
                "PracticeItemId",
                "ProvenanceFactIds",
                "RecordId",
                "RecordedAt",
                "RequestedEvent",
                "SuggestedStepId"
            });

        string serialized = JsonSerializer.Serialize(record);
        await Assert.That(serialized)
            .DoesNotContain("Which phrase describes");
        await Assert.That(serialized).DoesNotContain("coaching agent");
        await Assert.That(serialized).DoesNotContain("SystemPrompt");
        await Assert.That(serialized).DoesNotContain("correctAnswer");
    }

    [Test]
    public async Task BadRequest_DoesNotRecordMove()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);

        using HttpResponseMessage response = await Coach(
            client,
            attempt.AttemptId,
            """{ "event": "notSupported" }""");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
        await Assert.That(Recorder.Snapshot()).IsEmpty();
    }

    [Test]
    public async Task UnknownAttempt_DoesNotRecordMove()
    {
        using HttpClient client = Factory.CreateClient();
        Runner.Result = CoachingAgentRunResult.FromText(AskJson());

        using HttpResponseMessage response = await Coach(
            client,
            "unknown-attempt",
            """{ "event": "helpRequested" }""");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
        await Assert.That(Recorder.Snapshot()).IsEmpty();
    }

    [Test]
    public async Task PhaseConflict_DoesNotRecordMove()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);

        using HttpResponseMessage response = await Coach(
            client,
            attempt.AttemptId,
            """{ "event": "diagnosisRequested" }""");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
        await Assert.That(Recorder.Snapshot()).IsEmpty();
    }

    [Test]
    public async Task ProviderFailure_DoesNotRecordMove()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);
        Runner.Result = CoachingAgentRunResult.FromError(
            new AgentError(new AuthFailed("auth failed")));

        using HttpResponseMessage response = await Coach(
            client,
            attempt.AttemptId,
            """{ "event": "helpRequested" }""");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadGateway);
        await Assert.That(Recorder.Snapshot()).IsEmpty();
    }

    [Test]
    public async Task RateLimit_DoesNotRecordMove()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);
        Runner.Result = CoachingAgentRunResult.FromError(
            new AgentError(new RateLimited(RetryAfter: null)));

        using HttpResponseMessage response = await Coach(
            client,
            attempt.AttemptId,
            """{ "event": "helpRequested" }""");

        await Assert.That(response.StatusCode)
            .IsEqualTo(HttpStatusCode.TooManyRequests);
        await Assert.That(Recorder.Snapshot()).IsEmpty();
    }

    [Test]
    public async Task CancelledTurn_DoesNotRecordMove()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);
        Runner.Result = CoachingAgentRunResult.FromError(
            new AgentError(new Cancelled()));

        using HttpResponseMessage response = await Coach(
            client,
            attempt.AttemptId,
            """{ "event": "helpRequested" }""");

        await Assert.That((int)response.StatusCode).IsEqualTo(499);
        await Assert.That(Recorder.Snapshot()).IsEmpty();
    }

    [Test]
    public async Task InvalidModelOutput_DoesNotRecordMove()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);
        Runner.Result = CoachingAgentRunResult.FromText(
            "not json raw-model-secret");

        using HttpResponseMessage response = await Coach(
            client,
            attempt.AttemptId,
            """{ "event": "helpRequested" }""");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadGateway);
        await Assert.That(Recorder.Snapshot()).IsEmpty();
    }

    [Test]
    public async Task RepeatedSuccessfulTurns_RecordSeparateMoves()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);
        Runner.Result = CoachingAgentRunResult.FromText(AskJson());

        for (int turn = 0; turn < 3; turn++)
        {
            using HttpResponseMessage response = await Coach(
                client,
                attempt.AttemptId,
                """{ "event": "helpRequested" }""");
            await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        }

        IReadOnlyList<CoachingMoveRecord> records = Recorder.Snapshot();
        await Assert.That(records.Count).IsEqualTo(3);
        await Assert.That(records.Select(record => record.RecordId).Distinct().Count())
            .IsEqualTo(3);
    }

    [Test]
    public async Task Snapshot_IsImmutable()
    {
        var recorder = new InMemoryCoachingMoveRecorder();
        recorder.Record(SampleRecord("record-1"));

        IReadOnlyList<CoachingMoveRecord> snapshot = recorder.Snapshot();
        recorder.Record(SampleRecord("record-2"));

        await Assert.That(snapshot.Count).IsEqualTo(1);
        await Assert.That(recorder.Snapshot().Count).IsEqualTo(2);
        var asList = (System.Collections.IList)snapshot;
        await Assert.That(asList.IsReadOnly).IsTrue();
    }

    [Test]
    public async Task ConcurrentRecording_PreservesEveryMove()
    {
        var recorder = new InMemoryCoachingMoveRecorder();

        await Task.WhenAll(Enumerable.Range(0, 16).Select(worker =>
            Task.Run(() =>
            {
                for (int index = 0; index < 50; index++)
                {
                    recorder.Record(SampleRecord($"record-{worker}-{index}"));
                }
            })));

        IReadOnlyList<CoachingMoveRecord> records = recorder.Snapshot();
        await Assert.That(records.Count).IsEqualTo(800);
        await Assert.That(records.Select(record => record.RecordId).Distinct().Count())
            .IsEqualTo(800);
    }

    [Test]
    public async Task Recording_DoesNotMutateAttemptHistory()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);
        Runner.Result = CoachingAgentRunResult.FromText(AskJson());

        using HttpResponseMessage coach = await Coach(
            client,
            attempt.AttemptId,
            """{ "event": "helpRequested" }""");
        await Assert.That(coach.StatusCode).IsEqualTo(HttpStatusCode.OK);

        using HttpResponseMessage read = await client.GetAsync(
            $"/api/attempts/{attempt.AttemptId}");
        AttemptProjectionResponse projection = await ReadAttempt(read);

        await Assert.That(projection.CheckCount).IsEqualTo(0);
        await Assert.That(Recorder.Snapshot().Count).IsEqualTo(1);
    }

    private ICoachingMoveRecorder Recorder =>
        Factory.Services.GetRequiredService<ICoachingMoveRecorder>();

    private static CoachingMoveRecord SampleRecord(string recordId) =>
        new(
            RecordId: recordId,
            AttemptId: "attempt-sample",
            PracticeItemId: "practice-item-sample-1",
            CheckCount: 0,
            Phase: CoachContractNames.BeforeCheck,
            RequestedEvent: CoachContractNames.HelpRequested,
            MoveKind: CoachContractNames.AskReadingQuestion,
            FocusPhraseIds: [],
            SuggestedStepId: null,
            ProvenanceFactIds: [],
            RecordedAt: DateTimeOffset.UnixEpoch);

    private static async Task<AttemptProjectionResponse> StartAttempt(
        HttpClient client,
        string practiceItemId = "practice-item-sample-1")
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/attempts",
            new { practiceItemId });
        return await ReadAttempt(response);
    }

    private static async Task<AttemptProjectionResponse> CheckAttempt(
        HttpClient client,
        string attemptId,
        string answerId)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/attempts/{attemptId}/checks",
            new { selectedAnswerId = answerId });
        return await ReadAttempt(response);
    }

    private static async Task<HttpResponseMessage> Coach(
        HttpClient client,
        string attemptId,
        string json) =>
        await client.PostAsync(
            $"/api/attempts/{attemptId}/coach",
            new StringContent(json, Encoding.UTF8, "application/json"));

    private static async Task<AttemptProjectionResponse> ReadAttempt(
        HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<AttemptProjectionResponse>()
        ?? throw new InvalidOperationException("Attempt response was empty.");

    private static string AskJson() =>
        """
        {"move":"askReadingQuestion","message":"Which phrase describes how the two integers are related?","focusPhraseIds":["phrase-ordered-step"],"suggestedStepId":null,"provenanceFactIds":[]}
        """;

    private static string DiagnoseJson() =>
        """
        {"move":"diagnoseDifference","message":"Your answer names only the second integer, not the sum of both integers.","focusPhraseIds":["phrase-target"],"suggestedStepId":null,"provenanceFactIds":[]}
        """;
}
