using System.Net;
using System.Net.Http.Json;
using System.Text;

using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

public sealed class ScaffoldSessionEndpointTests : ApiTestBase
{
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
        await Assert.That(session.EntryStepId)
            .IsEqualTo("step-join-known-quantities");
        await Assert.That(session.ScaffoldId)
            .IsEqualTo("scaffold-parity-ladder");
        await Assert.That(session.State)
            .IsTypeOf<ActiveScaffoldSessionResponse>();
        await Assert.That(((ActiveScaffoldSessionResponse)session.State).CurrentStep.Id)
            .IsEqualTo("step-join-known-quantities");
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
    public async Task StartSession_BeforeCheckReturnsConflict()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/attempts/{attempt.AttemptId}/scaffold-sessions",
            null);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
    }

    [Test]
    public async Task StartSession_InitialHintReturnsConflict()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);
        await SubmitAttemptCheck(client, attempt.AttemptId, "answer-b");

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/attempts/{attempt.AttemptId}/scaffold-sessions",
            null);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
    }

    [Test]
    public async Task StartSession_NoScaffoldReturnsConflict()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(
            client,
            "practice-item-sample-2");
        await SubmitAttemptCheck(client, attempt.AttemptId, "answer-b");
        await SubmitAttemptCheck(client, attempt.AttemptId, "answer-b");

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/attempts/{attempt.AttemptId}/scaffold-sessions",
            null);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
    }

    [Test]
    public async Task StartSession_CorrectAttemptReturnsConflict()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);
        await SubmitAttemptCheck(client, attempt.AttemptId, "answer-d");

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/attempts/{attempt.AttemptId}/scaffold-sessions",
            null);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
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
            .IsEqualTo("step-join-known-quantities");
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
        await Assert.That(session.LastCheck.StepId)
            .IsEqualTo("step-join-known-quantities");
        await Assert.That(state.CurrentStep.Id)
            .IsEqualTo("step-join-known-quantities");
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
            .IsEqualTo("step-count-base-parts");
    }

    [Test]
    public async Task FinalSatisfiedStep_ReturnsCompleted()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse started = await StartAuthorizedSession(client);

        string[] submissions =
        [
            CorrectJoinJson(),
            "{ \"type\": \"enterScalar\", \"value\": 2 }",
            "{ \"type\": \"enterScalar\", \"value\": 2 }",
            CorrectJoinJson(),
            "{ \"type\": \"buildExpression\", \"mathObjectId\": \"math-requested-value-composed\" }",
            "{ \"type\": \"buildExpression\", \"mathObjectId\": \"math-answer-d\" }",
            "{ \"type\": \"selectAnswerChoice\", \"answerChoiceId\": \"answer-d\" }"
        ];

        HttpResponseMessage? lastResponse = null;
        try
        {
            foreach (string submission in submissions)
            {
                lastResponse?.Dispose();
                lastResponse = await PostJson(
                    client,
                    $"/api/scaffold-sessions/{started.SessionId}/checks",
                    submission);
            }

            ScaffoldSessionResponse session = await ReadSession(lastResponse!);
            await Assert.That(lastResponse!.StatusCode).IsEqualTo(HttpStatusCode.OK);
            await Assert.That(session.CompletedStepCount).IsEqualTo(7);
            await Assert.That(session.TotalStepCount).IsEqualTo(7);
            await Assert.That(session.State)
                .IsTypeOf<CompletedScaffoldSessionResponse>();
        }
        finally
        {
            lastResponse?.Dispose();
        }
    }

    [Test]
    public async Task CheckCompletedSession_ReturnsConflict()
    {
        using HttpClient client = Factory.CreateClient();
        ScaffoldSessionResponse started = await StartAuthorizedSession(client);
        await CompleteSession(client, started.SessionId);

        using HttpResponseMessage response = await PostJson(
            client,
            $"/api/scaffold-sessions/{started.SessionId}/checks",
            "{ \"type\": \"selectAnswerChoice\", \"answerChoiceId\": \"answer-d\" }");

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
            .IsEqualTo("step-join-known-quantities");
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

    private static async Task CompleteSession(
        HttpClient client,
        string sessionId)
    {
        string[] submissions =
        [
            CorrectJoinJson(),
            "{ \"type\": \"enterScalar\", \"value\": 2 }",
            "{ \"type\": \"enterScalar\", \"value\": 2 }",
            CorrectJoinJson(),
            "{ \"type\": \"buildExpression\", \"mathObjectId\": \"math-requested-value-composed\" }",
            "{ \"type\": \"buildExpression\", \"mathObjectId\": \"math-answer-d\" }",
            "{ \"type\": \"selectAnswerChoice\", \"answerChoiceId\": \"answer-d\" }"
        ];

        foreach (string submission in submissions)
        {
            using HttpResponseMessage response = await PostJson(
                client,
                $"/api/scaffold-sessions/{sessionId}/checks",
                submission);
            await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        }
    }

    private static string CorrectJoinJson() =>
        """
        { "type": "joinQuantities", "parts": [
          { "type": "latentExpression", "latentMathId": "latent-second-member" },
          { "type": "semanticQuantity", "semanticEntityId": "entity-n" }
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
