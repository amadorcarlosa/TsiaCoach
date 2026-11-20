using System.Net;
using System.Net.Http.Json;
using System.Text;
using TsiaCoach.WebApi.CoachingAgents;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

public sealed class CoachPlaygroundActivityTests : CoachApiTestBase
{
    private const string ProbeAnsweredJson =
        """{ "event": "probeAnswered", "answer": "one is left over when you pair them" }""";

    [Test]
    public async Task Coach_PromptIncludesServerPlaygroundSummaryForTheAttempt()
    {
        using HttpClient client = Factory.CreateClient();
        string attemptId = await StartAttempt(client);
        string sessionId = await StartPlaygroundSession(client, attemptId);
        object[] events = Enumerable.Range(0, 3)
            .Select(seq => (object)new
            {
                id = Guid.NewGuid().ToString("D"),
                sessionId,
                playground = "scaffold",
                seq,
                at = DateTimeOffset.UnixEpoch.AddSeconds(seq).ToString("O"),
                type = "step.checked",
                outcome = "rejected",
                reason = "the-rods-do-not-match-yet",
                data = new { stepId = "step-rebuild-from-twos-and-ones", satisfied = false },
            })
            .ToArray();
        using HttpResponseMessage append = await client.PostAsJsonAsync(
            $"/api/playground-sessions/{sessionId}/events", new { sessionId, events });
        Runner.Result = CoachingAgentRunResult.FromText("""{"move":"routeToStep","shapeId":"structural"}""");

        using HttpResponseMessage response = await Coach(client, attemptId, ProbeAnsweredJson);

        await Assert.That(append.StatusCode).IsEqualTo(HttpStatusCode.OK);
        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        CoachingAgentDefinition definition = Runner.Definitions.Single();
        await Assert.That(definition.Prompt).Contains("\"playgroundActivity\"");
        await Assert.That(definition.Prompt).Contains("\"step.checked\": 3");
        await Assert.That(definition.Prompt).Contains("the-rods-do-not-match-yet");
        await Assert.That(definition.Prompt).Contains("\"repeats\": 3");
        // Event data stays out: the probe prompt must not reveal step ids.
        await Assert.That(definition.Prompt).DoesNotContain("step-");
        await Assert.That(definition.SystemPrompt).Contains("playgroundActivity");
    }

    [Test]
    public async Task Coach_PromptOmitsActivityWhenTheAttemptHasNone()
    {
        using HttpClient client = Factory.CreateClient();
        string attemptId = await StartAttempt(client);
        // A session for another attempt must not leak into this one.
        string other = await StartAttempt(client);
        await StartPlaygroundSession(client, other);
        Runner.Result = CoachingAgentRunResult.FromText("""{"move":"routeToStep","shapeId":"structural"}""");

        using HttpResponseMessage response = await Coach(client, attemptId, ProbeAnsweredJson);

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        await Assert.That(Runner.Definitions.Single().Prompt).DoesNotContain("playgroundActivity");
    }

    private static async Task<string> StartAttempt(HttpClient client)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/attempts", new { practiceItemId = "practice-item-sample-1" });
        AttemptProjectionResponse attempt = await response.Content.ReadFromJsonAsync<AttemptProjectionResponse>()
            ?? throw new InvalidOperationException();
        return attempt.AttemptId;
    }

    private static async Task<string> StartPlaygroundSession(HttpClient client, string attemptId)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/playground-sessions", new { playground = "scaffold", attemptId });
        PlaygroundSessionResponse session = await response.Content.ReadFromJsonAsync<PlaygroundSessionResponse>()
            ?? throw new InvalidOperationException();
        return session.SessionId;
    }

    private static Task<HttpResponseMessage> Coach(HttpClient client, string attemptId, string json) =>
        client.PostAsync(
            $"/api/attempts/{attemptId}/coach",
            new StringContent(json, Encoding.UTF8, "application/json"));
}
