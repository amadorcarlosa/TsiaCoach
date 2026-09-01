using System.Net;
using System.Net.Http.Json;
using System.Text;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

public sealed class AttemptEndpointTests : ApiTestBase
{
    [Test]
    public async Task StartAttempt_ReturnsCreatedBeforeCheckProjection()
    {
        using HttpClient client = Factory.CreateClient();
        using HttpResponseMessage response = await Start(client, "practice-item-sample-1");
        AttemptProjectionResponse projection = await ReadProjection(response);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
        await Assert.That(projection.CheckCount).IsEqualTo(0);
        await Assert.That(projection.Phase).IsTypeOf<BeforeCheckResponse>();
        await Assert.That(projection.CoachingButton).IsTypeOf<VisibleCoachingButtonResponse>();
        await Assert.That(((VisibleCoachingButtonResponse)projection.CoachingButton).Label)
            .IsEqualTo("Help");
    }

    [Test]
    public async Task StartAttempt_ReturnsReadableLocation()
    {
        using HttpClient client = Factory.CreateClient();
        using HttpResponseMessage start = await Start(client, "practice-item-sample-1");

        await Assert.That(start.Headers.Location).IsNotNull();
        using HttpResponseMessage read = await client.GetAsync(start.Headers.Location);
        await Assert.That(read.StatusCode).IsEqualTo(HttpStatusCode.OK);
    }

    [Test]
    public async Task StartAttempt_RejectsUnknownPracticeItem()
    {
        using HttpClient client = Factory.CreateClient();
        using HttpResponseMessage response = await Start(client, "unknown-item");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
        await Assert.That(response.Content.Headers.ContentType?.MediaType)
            .IsEqualTo("application/problem+json");
    }

    [Test]
    public async Task StartAttempt_RejectsBlankPracticeItemId()
    {
        using HttpClient client = Factory.CreateClient();
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/attempts", new { practiceItemId = " " });

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
        await Assert.That(response.Content.Headers.ContentType?.MediaType)
            .IsEqualTo("application/problem+json");
    }

    [Test]
    public async Task StartAttempt_RejectsClientAuthoredAttemptState()
    {
        using HttpClient client = Factory.CreateClient();
        using HttpResponseMessage response = await PostJson(client, "/api/attempts", """
            { "practiceItemId": "practice-item-sample-1", "attemptId": "spoofed" }
            """);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    }

    [Test]
    public async Task ReadAttempt_ReturnsLatestProjection()
    {
        using HttpClient client = Factory.CreateClient();
        using HttpResponseMessage start = await Start(client, "practice-item-sample-1");
        AttemptProjectionResponse initial = await ReadProjection(start);

        using HttpResponseMessage check = await client.PostAsJsonAsync(
            $"/api/attempts/{initial.AttemptId}/checks",
            new { selectedAnswerId = "answer-b" });
        using HttpResponseMessage read = await client.GetAsync(
            $"/api/attempts/{initial.AttemptId}");
        AttemptProjectionResponse projection = await read.Content
            .ReadFromJsonAsync<AttemptProjectionResponse>() ?? throw new InvalidOperationException();

        await Assert.That(check.StatusCode).IsEqualTo(HttpStatusCode.OK);
        await Assert.That(projection.CheckCount).IsEqualTo(1);
        await Assert.That(projection.Phase).IsTypeOf<AfterIncorrectCheckResponse>();
    }

    [Test]
    public async Task ReadUnknownAttempt_ReturnsNotFound()
    {
        using HttpClient client = Factory.CreateClient();
        using HttpResponseMessage response = await client.GetAsync(
            "/api/attempts/does-not-exist");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    }

    [Test]
    public async Task IncorrectCheck_IsEvaluatedServerSide()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartProjection(client);

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/attempts/{attempt.AttemptId}/checks",
            new { selectedAnswerId = "answer-b" });
        AttemptProjectionResponse projection = await ReadProjection(response);
        AfterIncorrectCheckResponse incorrect = (AfterIncorrectCheckResponse)projection.Phase;

        await Assert.That(projection.CheckCount).IsEqualTo(1);
        await Assert.That(incorrect.MisconceptionCode).IsEqualTo("stopped-at-second-integer");
        await Assert.That(incorrect.Purpose).IsEqualTo("representation");
    }

    [Test]
    public async Task ItemOneIncorrectCheck_ReturnsScaffoldEntry()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartProjection(client);
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/attempts/{attempt.AttemptId}/checks",
            new { selectedAnswerId = "answer-b" });
        AfterIncorrectCheckResponse incorrect =
            (AfterIncorrectCheckResponse)(await ReadProjection(response)).Phase;

        ScaffoldEntryRouteResponse route = (ScaffoldEntryRouteResponse)incorrect.Route;
        await Assert.That(route.ScaffoldId).IsEqualTo("scaffold-parity-ladder");
        await Assert.That(route.EntryStepId).IsEqualTo("step-join-known-quantities");
    }

    [Test]
    public async Task ItemTwoIncorrectCheck_ReturnsNoScaffoldAuthored()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartProjection(
            client, "practice-item-sample-2");
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/attempts/{attempt.AttemptId}/checks",
            new { selectedAnswerId = "answer-a" });
        AfterIncorrectCheckResponse incorrect =
            (AfterIncorrectCheckResponse)(await ReadProjection(response)).Phase;

        await Assert.That(incorrect.Route).IsTypeOf<NoScaffoldAuthoredRouteResponse>();
    }

    [Test]
    public async Task SecondCheckOnSamePurpose_ReturnsEscalatedHint()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartProjection(client);
        await Check(client, attempt.AttemptId, "answer-a");
        AttemptProjectionResponse projection = await Check(client, attempt.AttemptId, "answer-c");
        AfterIncorrectCheckResponse incorrect = (AfterIncorrectCheckResponse)projection.Phase;

        await Assert.That(incorrect.RouteStreak).IsEqualTo(2);
        await Assert.That(incorrect.HintLevel).IsEqualTo("escalated");
    }

    [Test]
    public async Task DifferentPurposeCheck_ResetsRouteStreak()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartProjection(client);
        await Check(client, attempt.AttemptId, "answer-a");
        AttemptProjectionResponse projection = await Check(client, attempt.AttemptId, "answer-b");
        AfterIncorrectCheckResponse incorrect = (AfterIncorrectCheckResponse)projection.Phase;

        await Assert.That(incorrect.RouteStreak).IsEqualTo(1);
        await Assert.That(incorrect.HintLevel).IsEqualTo("initial");
    }

    [Test]
    public async Task AfterCorrectProjection_ShowsWhyItWorksButton()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartProjection(client);
        AttemptProjectionResponse projection = await Check(client, attempt.AttemptId, "answer-d");

        await Assert.That(projection.Phase).IsTypeOf<AfterCorrectCheckResponse>();
        await Assert.That(projection.CoachingButton).IsTypeOf<VisibleCoachingButtonResponse>();
        await Assert.That(((VisibleCoachingButtonResponse)projection.CoachingButton).Label)
            .IsEqualTo("Why it works");
    }

    [Test]
    public async Task CheckRejectsForeignAnswerChoice()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartProjection(client);
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/attempts/{attempt.AttemptId}/checks",
            new { selectedAnswerId = "answer-from-another-item" });

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    }

    [Test]
    public async Task CheckRejectsClientAuthoredOutcomeFields()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartProjection(client);
        using HttpResponseMessage response = await PostJson(
            client,
            $"/api/attempts/{attempt.AttemptId}/checks",
            """
            { "selectedAnswerId": "answer-a", "isCorrect": true,
              "phase": "afterCorrectCheck", "misconceptionCode": "anything" }
            """);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    }

    [Test]
    public async Task CheckUnknownAttempt_ReturnsNotFound()
    {
        using HttpClient client = Factory.CreateClient();
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/attempts/unknown/checks",
            new { selectedAnswerId = "answer-a" });

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    }

    [Test]
    public async Task CheckAfterCorrect_ReturnsConflict()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartProjection(client);
        await Check(client, attempt.AttemptId, "answer-d");
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/attempts/{attempt.AttemptId}/checks",
            new { selectedAnswerId = "answer-a" });

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
    }

    [Test]
    public async Task ConcurrentIncorrectChecks_DoNotLoseHistory()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartProjection(client);
        Task<HttpResponseMessage>[] checks = Enumerable.Range(0, 8)
            .Select(_ => client.PostAsJsonAsync(
                $"/api/attempts/{attempt.AttemptId}/checks",
                new { selectedAnswerId = "answer-a" }))
            .ToArray();

        HttpResponseMessage[] responses = await Task.WhenAll(checks);
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
            $"/api/attempts/{attempt.AttemptId}");
        AttemptProjectionResponse latest = await ReadProjection(read);
        await Assert.That(latest.CheckCount).IsEqualTo(8);
    }

    [Test]
    public async Task AttemptProjection_DoesNotExposeCorrectAnswerId()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartProjection(client);
        using HttpResponseMessage response = await client.GetAsync(
            $"/api/attempts/{attempt.AttemptId}");
        string json = await response.Content.ReadAsStringAsync();

        await Assert.That(json).DoesNotContain("correctAnswerId");
    }

    [Test]
    public async Task AttemptProjection_DoesNotExposeCheckHistory()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartProjection(client);
        await Check(client, attempt.AttemptId, "answer-a");
        using HttpResponseMessage response = await client.GetAsync(
            $"/api/attempts/{attempt.AttemptId}");
        string json = await response.Content.ReadAsStringAsync();

        await Assert.That(json).DoesNotContain("checks");
        await Assert.That(json).DoesNotContain("checkedAt");
        await Assert.That(json).DoesNotContain("checkResultId");
    }

    [Test]
    public async Task AttemptProjectionJson_UsesPhaseAndRouteDiscriminators()
    {
        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartProjection(client);
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/attempts/{attempt.AttemptId}/checks",
            new { selectedAnswerId = "answer-b" });
        string json = await response.Content.ReadAsStringAsync();

        await Assert.That(json).Contains("\"type\":\"afterIncorrectCheck\"");
        await Assert.That(json).Contains("\"type\":\"scaffoldEntry\"");
        await Assert.That(json).Contains("\"type\":\"visible\"");
    }

    private static async Task<HttpResponseMessage> Start(
        HttpClient client,
        string itemId) => await client.PostAsJsonAsync(
            "/api/attempts", new { practiceItemId = itemId });

    private static async Task<AttemptProjectionResponse> StartProjection(
        HttpClient client,
        string itemId = "practice-item-sample-1")
    {
        using HttpResponseMessage response = await Start(client, itemId);
        return await ReadProjection(response);
    }

    private static async Task<AttemptProjectionResponse> Check(
        HttpClient client,
        string attemptId,
        string answerId)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/attempts/{attemptId}/checks",
            new { selectedAnswerId = answerId });
        return await ReadProjection(response);
    }

    private static async Task<AttemptProjectionResponse> ReadProjection(
        HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<AttemptProjectionResponse>()
        ?? throw new InvalidOperationException("Response did not contain a projection.");

    private static async Task<HttpResponseMessage> PostJson(
        HttpClient client,
        string path,
        string json) => await client.PostAsync(
            path,
            new StringContent(json, Encoding.UTF8, "application/json"));
}
