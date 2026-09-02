using System.Net;
using System.Net.Http.Json;
using System.Text;

using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

public sealed class ScaffoldSessionEndpointTests : ApiTestBase
{
    private const string FloorStepId = "step-rebuild-from-twos-and-ones";
    private const string JoinStepId = "step-join-and-read-sum";

    [Test]
    public async Task StartSession_EscalatedRouteReturnsCreatedAtAuthorizedEntry()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await CreateEscalatedAttempt(client);

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/attempts/{attempt.AttemptId}/scaffold-sessions",
            content: null);
        ScaffoldSessionResponse session = await ReadSession(response);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
        await Assert.That(session.EntryStepId).IsEqualTo(JoinStepId);
        await Assert.That(session.ScaffoldId)
            .IsEqualTo("scaffold-parity-ladder");
        await Assert.That(session.State)
            .IsTypeOf<ActiveScaffoldSessionResponse>();
        await Assert.That(((ActiveScaffoldSessionResponse)session.State).CurrentStep.Id)
            .IsEqualTo(JoinStepId);
        await Assert.That(session.TotalStepCount).IsEqualTo(3);
    }

    [Test]
    public async Task StartSession_RepeatedRequestReturnsExistingSession()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await CreateEscalatedAttempt(client);
        string path = $"/api/attempts/{attempt.AttemptId}/scaffold-sessions";

        using HttpResponseMessage firstResponse = await client.PostAsync(path, null);
        ScaffoldSessionResponse first = await ReadSession(firstResponse);
        using HttpResponseMessage secondResponse = await client.PostAsync(path, null);
        ScaffoldSessionResponse second = await ReadSession(secondResponse);

        await Assert.That(firstResponse.StatusCode).IsEqualTo(HttpStatusCode.Created);
        await Assert.That(secondResponse.StatusCode).IsEqualTo(HttpStatusCode.OK);
        await Assert.That(second.SessionId).IsEqualTo(first.SessionId);
    }

    [Test]
    public async Task StartSession_BeforeCheckReturnsCreatedAtFloor()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/attempts/{attempt.AttemptId}/scaffold-sessions",
            null);
        ScaffoldSessionResponse session = await ReadSession(response);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
        await Assert.That(session.EntryStepId).IsEqualTo(FloorStepId);
        await Assert.That(session.TotalStepCount).IsEqualTo(6);
        await Assert.That(((ActiveScaffoldSessionResponse)session.State).CurrentStep.Scene)
            .IsTypeOf<RodMeasurementSceneResponse>();
    }

    [Test]
    public async Task StartSession_FirstIncorrectReturnsCreatedAtRoutedEntry()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);
        await SubmitAttemptCheck(client, attempt.AttemptId, "answer-b");

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/attempts/{attempt.AttemptId}/scaffold-sessions",
            null);
        ScaffoldSessionResponse session = await ReadSession(response);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
        await Assert.That(session.EntryStepId).IsEqualTo(JoinStepId);
    }

    [Test]
    public async Task StartSession_NoScaffoldReturnsConflict()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(
            client,
            "practice-item-sample-2");

        using HttpResponseMessage beforeCheck = await client.PostAsync(
            $"/api/attempts/{attempt.AttemptId}/scaffold-sessions",
            null);
        await SubmitAttemptCheck(client, attempt.AttemptId, "answer-b");
        using HttpResponseMessage afterCheck = await client.PostAsync(
            $"/api/attempts/{attempt.AttemptId}/scaffold-sessions",
            null);

        await Assert.That(beforeCheck.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
        await Assert.That(afterCheck.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
    }

    [Test]
    public async Task StartSession_CorrectAttemptReturnsCreatedAtFloor()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);
        await SubmitAttemptCheck(client, attempt.AttemptId, "answer-d");

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/attempts/{attempt.AttemptId}/scaffold-sessions",
            null);
        ScaffoldSessionResponse session = await ReadSession(response);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
        await Assert.That(session.EntryStepId).IsEqualTo(FloorStepId);
    }

    [Test]
    public async Task StartSession_UnknownAttemptReturnsNotFound()
    {
        using HttpClient client = Factory.CreateClient();

        using HttpResponseMessage response = await client.PostAsync(
            "/api/attempts/does-not-exist/scaffold-sessions",
            null);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    }

    [Test]
    public async Task ReadSession_ReturnsCurrentSafeStep()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse started = await StartAuthorizedSession(client);

        using HttpResponseMessage response = await client.GetAsync(
            $"/api/scaffold-sessions/{started.SessionId}");
        ScaffoldSessionResponse session = await ReadSession(response);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        await Assert.That(session.CheckCount).IsEqualTo(0);
        await Assert.That(session.State)
            .IsTypeOf<ActiveScaffoldSessionResponse>();
        await Assert.That(((ActiveScaffoldSessionResponse)session.State).CurrentStep.Id)
            .IsEqualTo(JoinStepId);
        await Assert.That(session.LastCheck).IsNull();
    }

    [Test]
    public async Task ReadUnknownSession_ReturnsNotFound()
    {
        using HttpClient client = Factory.CreateClient();

        using HttpResponseMessage response = await client.GetAsync(
            "/api/scaffold-sessions/does-not-exist");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    }

    [Test]
    public async Task IncorrectStepCheck_ReturnsUnsatisfiedAndSameStep()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse started = await StartAuthorizedSession(client);

        using HttpResponseMessage response = await PostJson(
            client,
            $"/api/scaffold-sessions/{started.SessionId}/checks",
            """
            { "type": "joinQuantities", "parts": [
              { "type": "semanticQuantity", "semanticEntityId": "entity-n" }
            ] }
            """);
        ScaffoldSessionResponse session = await ReadSession(response);
        ActiveScaffoldSessionResponse state = (ActiveScaffoldSessionResponse)session.State;

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        await Assert.That(session.CheckCount).IsEqualTo(1);
        await Assert.That(session.LastCheck!.Satisfied).IsFalse();
        await Assert.That(session.LastCheck.StepId).IsEqualTo(JoinStepId);
        await Assert.That(state.CurrentStep.Id).IsEqualTo(JoinStepId);
    }

    [Test]
    public async Task SatisfiedStepCheck_AdvancesToNextStep()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse started = await StartAuthorizedSession(client);

        using HttpResponseMessage response = await PostJson(
            client,
            $"/api/scaffold-sessions/{started.SessionId}/checks",
            CorrectJoinJson());
        ScaffoldSessionResponse session = await ReadSession(response);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        await Assert.That(session.LastCheck!.Satisfied).IsTrue();
        await Assert.That(session.CompletedStepCount).IsEqualTo(1);
        await Assert.That(((ActiveScaffoldSessionResponse)session.State).CurrentStep.Id)
            .IsEqualTo("step-name-bar-count");
    }

    [Test]
    public async Task FinalSatisfiedStep_ReturnsCompleted()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse started = await StartAuthorizedSession(client);

        ScaffoldSessionResponse session = await Submit(
            client,
            started.SessionId,
            RepresentationSubmissions());

        await Assert.That(session.CompletedStepCount).IsEqualTo(3);
        await Assert.That(session.TotalStepCount).IsEqualTo(3);
        await Assert.That(session.State)
            .IsTypeOf<CompletedScaffoldSessionResponse>();
    }

    [Test]
    public async Task FloorSession_TraversesTheWholePath()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);
        using HttpResponseMessage startResponse = await client.PostAsync(
            $"/api/attempts/{attempt.AttemptId}/scaffold-sessions",
            null);
        ScaffoldSessionResponse started = await ReadSession(startResponse);

        ScaffoldSessionResponse session = await Submit(
            client,
            started.SessionId,
            [
                CorrectClassificationJson(),
                """{ "type": "nameFitClassification", "domain": "oddIntegers" }""",
                CorrectGapTraversalJson(),
                .. RepresentationSubmissions()
            ]);

        await Assert.That(session.CompletedStepCount).IsEqualTo(6);
        await Assert.That(session.TotalStepCount).IsEqualTo(6);
        await Assert.That(session.State)
            .IsTypeOf<CompletedScaffoldSessionResponse>();
    }

    [Test]
    public async Task CheckCompletedSession_ReturnsConflict()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse started = await StartAuthorizedSession(client);
        await Submit(client, started.SessionId, RepresentationSubmissions());

        using HttpResponseMessage response = await PostJson(
            client,
            $"/api/scaffold-sessions/{started.SessionId}/checks",
            "{ \"type\": \"enterScalar\", \"value\": 2 }");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
    }

    [Test]
    public async Task CheckForeignSubmissionIdReturnsBadRequest()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse started = await StartAuthorizedSession(client);

        using HttpResponseMessage response = await PostJson(
            client,
            $"/api/scaffold-sessions/{started.SessionId}/checks",
            """
            { "type": "joinQuantities", "parts": [
              { "type": "semanticQuantity", "semanticEntityId": "entity-this-year" },
              { "type": "latentExpression", "latentMathId": "latent-second-member" }
            ] }
            """);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    }

    [Test]
    public async Task CheckRejectsClientAuthoredStepOutcomeOrExpectedFields()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse started = await StartAuthorizedSession(client);

        using HttpResponseMessage response = await PostJson(
            client,
            $"/api/scaffold-sessions/{started.SessionId}/checks",
            """
            { "type": "joinQuantities", "parts": [], "stepId": "spoofed",
              "satisfied": true, "expectedValueId": "spoofed",
              "correctAnswerId": "answer-d" }
            """);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    }

    [Test]
    public async Task CheckAcceptsTypeDiscriminatorAfterProperties()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse started = await StartAuthorizedSession(client);

        using HttpResponseMessage response = await PostJson(
            client,
            $"/api/scaffold-sessions/{started.SessionId}/checks",
            """
            { "parts": [
              { "semanticEntityId": "entity-n", "type": "semanticQuantity" },
              { "latentMathId": "latent-second-member", "type": "latentExpression" }
            ], "type": "joinQuantities" }
            """);
        ScaffoldSessionResponse session = await ReadSession(response);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        await Assert.That(session.LastCheck!.Satisfied).IsTrue();
    }

    [Test]
    public async Task CheckMissingTypeDiscriminatorReturnsBadRequest()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse started = await StartAuthorizedSession(client);

        using HttpResponseMessage response = await PostJson(
            client,
            $"/api/scaffold-sessions/{started.SessionId}/checks",
            """{ "parts": [] }""");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    }

    [Test]
    public async Task LanguageSession_ReturnsResolvedLearnerResourceAndScene()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse session = await StartLanguageSession(client);

        ScaffoldLearnerRodResourceResponse stepRod = session.Resources
            .OfType<ScaffoldLearnerRodResourceResponse>()
            .Single(resource => resource.Id == "resource-odd-step-rod");
        ActiveScaffoldSessionResponse state =
            (ActiveScaffoldSessionResponse)session.State;
        RodGapSceneResponse gap = state.CurrentStep.Scene as RodGapSceneResponse ??
            throw new InvalidOperationException("Expected a rod-gap scene.");

        await Assert.That(session.EntryStepId).IsEqualTo("step-select-consecutive-odds");
        await Assert.That(stepRod.Length).IsEqualTo(2);
        await Assert.That(gap.SpanSeriesId).IsEqualTo("resource-measurand-series");
    }

    [Test]
    public async Task MidPathEntry_AdvancesAlongTheSamePath()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse started = await StartLanguageSession(client);

        using HttpResponseMessage response = await PostJson(
            client,
            $"/api/scaffold-sessions/{started.SessionId}/checks",
            CorrectGapTraversalJson());
        ScaffoldSessionResponse advanced = await ReadSession(response);
        ActiveScaffoldSessionResponse state =
            (ActiveScaffoldSessionResponse)advanced.State;

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        await Assert.That(state.CurrentStep.Id).IsEqualTo(JoinStepId);
        await Assert.That(state.CurrentStep.Scene).IsTypeOf<QuantityJoinSceneResponse>();
        await Assert.That(advanced.TotalStepCount).IsEqualTo(4);
    }

    [Test]
    public async Task SessionJson_DoesNotExposeSolutionOrHistory()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse started = await StartAuthorizedSession(client);

        using HttpResponseMessage response = await client.GetAsync(
            $"/api/scaffold-sessions/{started.SessionId}");
        string json = await response.Content.ReadAsStringAsync();

        await Assert.That(json).DoesNotContain("successCheck");
        await Assert.That(json).DoesNotContain("expectedValueId");
        await Assert.That(json).DoesNotContain("expectedExpressionId");
        await Assert.That(json).DoesNotContain("correctAnswerId");
        await Assert.That(json).DoesNotContain("latentFacts");
        await Assert.That(json).DoesNotContain("misconceptionCode");
        await Assert.That(json).DoesNotContain("authorizedByCheckResultId");
        await Assert.That(json).DoesNotContain("checkedAt");
        await Assert.That(json).DoesNotContain("checks");
        await Assert.That(json).DoesNotContain("submission");
    }

    [Test]
    public async Task SessionJson_UsesStateDiscriminator()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse started = await StartAuthorizedSession(client);

        using HttpResponseMessage response = await client.GetAsync(
            $"/api/scaffold-sessions/{started.SessionId}");
        string json = await response.Content.ReadAsStringAsync();

        await Assert.That(json).Contains("\"state\":{\"type\":\"active\"");
    }

    [Test]
    public async Task ConcurrentIncorrectSessionChecks_DoNotLoseHistory()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse started = await StartAuthorizedSession(client);
        Task<HttpResponseMessage>[] tasks = Enumerable.Range(0, 8)
            .Select(_ => PostJson(
                client,
                $"/api/scaffold-sessions/{started.SessionId}/checks",
                """
                { "type": "joinQuantities", "parts": [
                  { "type": "semanticQuantity", "semanticEntityId": "entity-n" }
                ] }
                """))
            .ToArray();

        HttpResponseMessage[] responses = await Task.WhenAll(tasks);
        try
        {
            foreach (HttpResponseMessage response in responses)
            {
                await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
            }
        }
        finally
        {
            foreach (HttpResponseMessage response in responses)
            {
                response.Dispose();
            }
        }

        using HttpResponseMessage read = await client.GetAsync(
            $"/api/scaffold-sessions/{started.SessionId}");
        ScaffoldSessionResponse latest = await ReadSession(read);
        await Assert.That(latest.CheckCount).IsEqualTo(8);
        await Assert.That(((ActiveScaffoldSessionResponse)latest.State).CurrentStep.Id)
            .IsEqualTo(JoinStepId);
    }

    private static async Task<AttemptProjectionResponse> CreateEscalatedAttempt(
        HttpClient client)
    {
        AttemptProjectionResponse attempt = await StartAttempt(client);
        await SubmitAttemptCheck(client, attempt.AttemptId, "answer-b");
        return await SubmitAttemptCheck(client, attempt.AttemptId, "answer-b");
    }

    private static async Task<AttemptProjectionResponse> StartAttempt(
        HttpClient client,
        string itemId = "practice-item-sample-1")
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/attempts",
            new { practiceItemId = itemId });
        return await response.Content.ReadFromJsonAsync<AttemptProjectionResponse>()
            ?? throw new InvalidOperationException("Attempt response was empty.");
    }

    private static async Task<AttemptProjectionResponse> SubmitAttemptCheck(
        HttpClient client,
        string attemptId,
        string answerId)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/attempts/{attemptId}/checks",
            new { selectedAnswerId = answerId });
        return await response.Content.ReadFromJsonAsync<AttemptProjectionResponse>()
            ?? throw new InvalidOperationException("Attempt response was empty.");
    }

    private static async Task<ScaffoldSessionResponse> StartAuthorizedSession(
        HttpClient client)
    {
        AttemptProjectionResponse attempt = await CreateEscalatedAttempt(client);
        using HttpResponseMessage response = await client.PostAsync(
            $"/api/attempts/{attempt.AttemptId}/scaffold-sessions",
            null);
        return await ReadSession(response);
    }

    private static async Task<ScaffoldSessionResponse> StartLanguageSession(
        HttpClient client)
    {
        AttemptProjectionResponse attempt = await StartAttempt(client);
        await SubmitAttemptCheck(client, attempt.AttemptId, "answer-a");
        await SubmitAttemptCheck(client, attempt.AttemptId, "answer-a");
        using HttpResponseMessage response = await client.PostAsync(
            $"/api/attempts/{attempt.AttemptId}/scaffold-sessions",
            null);
        return await ReadSession(response);
    }

    private static async Task<ScaffoldSessionResponse> Submit(
        HttpClient client,
        string sessionId,
        IReadOnlyList<string> submissions)
    {
        ScaffoldSessionResponse? session = null;

        foreach (string submission in submissions)
        {
            using HttpResponseMessage response = await PostJson(
                client,
                $"/api/scaffold-sessions/{sessionId}/checks",
                submission);
            await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
            session = await ReadSession(response);
        }

        return session ?? throw new InvalidOperationException("No submissions were sent.");
    }

    private static string[] RepresentationSubmissions() =>
    [
        CorrectJoinJson(),
        "{ \"type\": \"enterScalar\", \"value\": 2 }",
        "{ \"type\": \"enterScalar\", \"value\": 2 }"
    ];

    private static string CorrectJoinJson() =>
        """
        { "type": "joinQuantities", "parts": [
          { "type": "latentExpression", "latentMathId": "latent-second-member" },
          { "type": "semanticQuantity", "semanticEntityId": "entity-n" }
        ] }
        """;

    private static string CorrectClassificationJson()
    {
        string entries = string.Join(",", Enumerable.Range(1, 10).Select(length =>
            $$"""{ "length": {{length}}, "classification": "{{(length % 2 == 0 ? "flush" : "oneUnitLeftover")}}" }"""));

        return $$"""{ "type": "classifyByFit", "classifications": [{{entries}}] }""";
    }

    private static string CorrectGapTraversalJson() =>
        """
        { "type": "traverseAllGaps", "traversals": [
          { "from": 1, "to": 3, "resourceId": "resource-odd-step-rod" },
          { "from": 3, "to": 5, "resourceId": "resource-odd-step-rod" },
          { "from": 5, "to": 7, "resourceId": "resource-odd-step-rod" },
          { "from": 7, "to": 9, "resourceId": "resource-odd-step-rod" }
        ] }
        """;

    private static async Task<ScaffoldSessionResponse> ReadSession(
        HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<ScaffoldSessionResponse>()
        ?? throw new InvalidOperationException("Scaffold session response was empty.");

    private static async Task<HttpResponseMessage> PostJson(
        HttpClient client,
        string path,
        string json) => await client.PostAsync(
            path,
            new StringContent(json, Encoding.UTF8, "application/json"));
}
