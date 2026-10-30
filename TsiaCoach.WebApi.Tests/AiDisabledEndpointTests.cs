using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using TUnit.AspNetCore;
using TsiaCoach.WebApi;

namespace TsiaCoach.WebApi.Tests;

public sealed class AiDisabledApiFactory : TestWebApplicationFactory<Program>
{
    protected override void ConfigureStartupConfiguration(IConfigurationBuilder configuration)
    {
        configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AI:Enabled"] = "false",
            ["AgentProvider"] = "Foundry",
            ["endpoint"] = null,
            ["foundryResource"] = null,
            ["OpenRouter:ApiKey"] = null
        });
    }
}

public sealed class AiDisabledEndpointTests : WebApplicationTest<AiDisabledApiFactory, Program>
{
    [Test]
    [Arguments("/api/agent")]
    [Arguments("/api/decisions")]
    [Arguments("/api/attempts/test/coach")]
    public async Task AiEndpoints_ReturnServiceUnavailable(string path)
    {
        using var client = Factory.CreateClient();
        using var response = await client.PostAsJsonAsync(path, new { });

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.ServiceUnavailable);
        var problem = await response.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        await Assert.That(problem!.Title).IsEqualTo("AI is disabled");
    }

    [Test]
    public async Task WithoutProviderConfiguration_HealthAndModelsRemainAvailable()
    {
        using var client = Factory.CreateClient();
        using var health = await client.GetAsync("/health");
        await Assert.That(health.StatusCode).IsEqualTo(HttpStatusCode.OK);
        var models = await client.GetFromJsonAsync<string[]>("/api/models");
        await Assert.That(models!.Length).IsEqualTo(0);
    }
}
