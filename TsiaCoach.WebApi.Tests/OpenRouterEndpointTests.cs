using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TUnit.AspNetCore;
using TsiaCoach.WebApi;
using TsiaCoach.WebApi.Agents;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

public sealed class OpenRouterApiFactory : TestWebApplicationFactory<Program>
{
    protected override void ConfigureStartupConfiguration(IConfigurationBuilder configuration)
    {
        configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AgentProvider"] = "OpenRouter",
            ["OpenRouter:ApiKey"] = "test-key",
            ["OpenRouter:Models:0"] = "openai/test-model",
            ["CoachingAgent:Model"] = "openai/test-model",
            ["endpoint"] = null,
            ["foundryResource"] = null
        });
    }
}

public sealed class OpenRouterEndpointTests : WebApplicationTest<OpenRouterApiFactory, Program>
{
    private readonly FakeAgentExecutor _executor = new();

    protected override void ConfigureTestServices(IServiceCollection services)
    {
        base.ConfigureTestServices(services);
        services.RemoveAll<IAgentExecutor>();
        services.AddSingleton<IAgentExecutor>(_executor);
    }

    [Test]
    public async Task Models_AdvertisesOpenRouter_WithoutAzureConfiguration()
    {
        using var client = Factory.CreateClient();
        using var response = await client.GetAsync("/api/models");
        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        using var models = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        await Assert.That(models.RootElement[0].GetProperty("name").GetString()).IsEqualTo("openai/test-model");
        await Assert.That(models.RootElement[0].GetProperty("vendor").GetString()).IsEqualTo("openRouter");
    }

    [Test]
    public async Task Coaching_UsesConfiguredOpenRouterModel_AndResolvesAuthoredRoute()
    {
        _executor.Result = new AgentReply(new Reply(
            """{"move":"routeToStep","shapeId":"structural"}""", null, null));
        using var client = Factory.CreateClient();
        using var attemptResponse = await client.PostAsJsonAsync("/api/attempts",
            new { practiceItemId = "practice-item-sample-1" });
        var attempt = (await attemptResponse.Content.ReadFromJsonAsync<AttemptProjectionResponse>())!;
        using var response = await client.PostAsJsonAsync($"/api/attempts/{attempt.AttemptId}/coach",
            new { @event = "probeAnswered", answer = "one left over after pairing" });
        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        await Assert.That(body.RootElement.GetProperty("move").GetProperty("type").GetString()).IsEqualTo("routeToStep");
        await Assert.That(_executor.LastModel).IsEqualTo("openai/test-model");
        var authored = TsiaCoach.Domain.SampleCoaching.PracticeItemOneCoachingPolicy.Probe.Shapes
            .Single(shape => shape.Id.Value == "structural");
        await Assert.That(body.RootElement.GetProperty("move").GetProperty("stepId").GetString()).IsEqualTo(authored.EntryStepId.Value);
        await Assert.That(body.RootElement.GetProperty("move").GetProperty("message").GetString()).IsEqualTo(authored.RouteMessage);
    }

    [Test]
    public async Task Agent_RejectsUnlistedModel()
    {
        using var client = Factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/agent",
            new { model = "unlisted/model", instructions = "Coach", prompt = "Hello", history = Array.Empty<object>() });
        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    }
}
