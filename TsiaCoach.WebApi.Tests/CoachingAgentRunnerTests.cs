using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.Extensions.AI;
using TsiaCoach.WebApi.Agents;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

public sealed class CoachingAgentRunnerTests : AgentApiTestBase
{
    [Test]
    public async Task Coach_RequestsStructuredJsonFromProvider()
    {
        Executor.Result = new AgentReply(
            new Reply(
                AskJson(),
                InputTokens: null,
                OutputTokens: null));

        using HttpClient client = Factory.CreateClient();
        AttemptProjectionResponse attempt = await StartAttempt(client);

        using HttpResponseMessage response = await Coach(
            client,
            attempt.AttemptId,
            """{ "event": "helpRequested" }""");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        await Assert.That(Executor.LastResponseFormat)
            .IsEqualTo(ChatResponseFormat.Json);
    }

    private static async Task<AttemptProjectionResponse> StartAttempt(
        HttpClient client)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/attempts",
            new { practiceItemId = "practice-item-sample-1" });

        return await response.Content.ReadFromJsonAsync<AttemptProjectionResponse>()
            ?? throw new InvalidOperationException("Attempt response was empty.");
    }

    private static async Task<HttpResponseMessage> Coach(
        HttpClient client,
        string attemptId,
        string json) =>
        await client.PostAsync(
            $"/api/attempts/{attemptId}/coach",
            new StringContent(json, Encoding.UTF8, "application/json"));

    private static string AskJson() =>
        """
        {"move":"askReadingQuestion","message":"Which phrase describes how the two integers are related?","focusPhraseIds":["phrase-ordered-step"],"suggestedStepId":null,"provenanceFactIds":[]}
        """;
}
