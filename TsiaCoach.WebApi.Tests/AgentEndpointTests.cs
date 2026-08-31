using System.Net;
using System.Net.Http.Json;
using TsiaCoach.WebApi.Agents;
using TsiaCoach.WebApi.Request;
using Microsoft.AspNetCore.Mvc;

using ApiAgentResponse =
    TsiaCoach.WebApi.Response.AgentResponse;

namespace TsiaCoach.WebApi.Tests;

public sealed class AgentEndpointTests : AgentApiTestBase
{
    [Test]
    public async Task Agent_ReturnsReplyAndTokenUsage()
    {
        Executor.Result = new AgentReply(
            new Reply(
                Text: "Fake Tobias response",
                InputTokens: 42,
                OutputTokens: 9));

        using HttpClient client = Factory.CreateClient();

        using HttpResponseMessage response =
            await client.PostAsJsonAsync(
                "/api/agent",
                CreateRequest());

        await Assert.That(response.StatusCode)
            .IsEqualTo(HttpStatusCode.OK);

        ApiAgentResponse? body =
            await response.Content
                .ReadFromJsonAsync<ApiAgentResponse>();

        await Assert.That(body is not null).IsTrue();
        await Assert.That(body!.Text)
            .IsEqualTo("Fake Tobias response");
        await Assert.That(body.Model)
            .IsEqualTo("gpt-5.4-mini");
        await Assert.That(body.InputTokens).IsEqualTo(42);
        await Assert.That(body.OutputTokens).IsEqualTo(9);

        await Assert.That(Executor.CallCount).IsEqualTo(1);
        await Assert.That(Executor.LastModel)
            .IsEqualTo("gpt-5.4-mini");

        await Assert.That(Executor.LastMessages!.Count)
            .IsEqualTo(1);

        await Assert.That(Executor.LastMessages[0].Text)
            .IsEqualTo("Hello Tobias");
    }

    [Test]
    public async Task Agent_UsesZeroWhenUsageIsMissing()
    {
        Executor.Result = new AgentReply(
            new Reply(
                Text: "No usage supplied",
                InputTokens: null,
                OutputTokens: null));

        using HttpClient client = Factory.CreateClient();

        using HttpResponseMessage response =
            await client.PostAsJsonAsync(
                "/api/agent",
                CreateRequest());

        await Assert.That(response.StatusCode)
            .IsEqualTo(HttpStatusCode.OK);

        ApiAgentResponse? body =
            await response.Content
                .ReadFromJsonAsync<ApiAgentResponse>();

        await Assert.That(body is not null).IsTrue();
        await Assert.That(body!.InputTokens).IsEqualTo(0);
        await Assert.That(body.OutputTokens).IsEqualTo(0);
    }

    [Test]
    public async Task Agent_UnknownModelReturnsBadRequest()
    {
        using HttpClient client = Factory.CreateClient();

        using HttpResponseMessage response =
            await client.PostAsJsonAsync(
                "/api/agent",
                CreateRequest("not-a-real-model"));

        await Assert.That(response.StatusCode)
            .IsEqualTo(HttpStatusCode.BadRequest);

        ProblemDetails? problem =
            await response.Content
                .ReadFromJsonAsync<ProblemDetails>();

        await Assert.That(problem is not null).IsTrue();
        await Assert.That(problem!.Title)
            .IsEqualTo("Unknown model");

        // Unknown models fail during AgentFactory.Create,
        // before the executor is called.
        await Assert.That(Executor.CallCount).IsEqualTo(0);
    }

    [Test]
    public async Task Agent_RateLimitedReturns429()
    {
        Executor.Result = new AgentReply(
            new AgentError(
                new RateLimited(
                    RetryAfter: TimeSpan.FromSeconds(30))));

        using HttpClient client = Factory.CreateClient();

        using HttpResponseMessage response =
            await client.PostAsJsonAsync(
                "/api/agent",
                CreateRequest());

        await Assert.That(response.StatusCode)
            .IsEqualTo(HttpStatusCode.TooManyRequests);

        await Assert.That(Executor.CallCount).IsEqualTo(1);
    }

    [Test]
    public async Task Agent_CancelledReturns499()
    {
        Executor.Result = new AgentReply(
            new AgentError(
                new Cancelled()));

        using HttpClient client = Factory.CreateClient();

        using HttpResponseMessage response =
            await client.PostAsJsonAsync(
                "/api/agent",
                CreateRequest());

        await Assert.That((int)response.StatusCode)
            .IsEqualTo(499);

        await Assert.That(Executor.CallCount).IsEqualTo(1);
    }

    private static AgentRequest CreateRequest(
        string model = "gpt-5.4-mini") =>
        new(
            Model: model,
            Instructions: "Answer briefly.",
            Prompt: "Hello Tobias",
            History: []);
}