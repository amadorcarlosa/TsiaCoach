namespace TsiaCoach.AppHost.Tests;

using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;

public sealed class AppHostConfigurationTests
{
    [Test]
    public async Task Api_GetsProviderSettingsAndSecrets_FromAppHostParameters()
    {
        var env = await ApiEnvironment(
            "--Parameters:ai-enabled=true",
            "--Parameters:agent-provider=OpenRouter",
            "--Parameters:openrouter-api-key=test-key",
            "--Parameters:openrouter-models=openai/a,openai/b",
            "--Parameters:foundry-endpoint=https://foundry.example",
            "--Parameters:foundry-resource=test-resource",
            "--Parameters:azure-tenant-id=test-tenant",
            "--Parameters:turso-url=https://db.example.turso.io",
            "--Parameters:turso-auth-token=test-token");

        await Assert.That(env["AI__Enabled"]).IsEqualTo("true");
        await Assert.That(env["AgentProvider"]).IsEqualTo("OpenRouter");
        await Assert.That(env["OpenRouter__ApiKey"]).IsEqualTo("test-key");
        await Assert.That(env["OpenRouter__Models"]).IsEqualTo("openai/a,openai/b");
        await Assert.That(env["endpoint"]).IsEqualTo("https://foundry.example");
        await Assert.That(env["foundryResource"]).IsEqualTo("test-resource");
        await Assert.That(env["tenantId"]).IsEqualTo("test-tenant");
        await Assert.That(env["PlaygroundEvents__Store"]).IsEqualTo("Turso");
        await Assert.That(env["PlaygroundEvents__Turso__Url"]).IsEqualTo("https://db.example.turso.io");
        await Assert.That(env["PlaygroundEvents__Turso__AuthToken"]).IsEqualTo("test-token");
    }

    [Test]
    public async Task Api_UsesInMemoryEvents_WithoutTursoUrl()
    {
        var env = await ApiEnvironment(
            "--Parameters:openrouter-api-key=test-key",
            "--Parameters:turso-url=");

        await Assert.That(env["PlaygroundEvents__Store"]).IsEqualTo("InMemory");
        await Assert.That(env.ContainsKey("PlaygroundEvents__Turso__AuthToken")).IsFalse();
    }

    [Test]
    public async Task Web_GetsPlaygroundEventsFlag_FromAppHostParameter()
    {
        var builder = await DistributedApplicationTestingBuilder.CreateAsync<Projects.TsiaCoach_AppHost>(
            ["--Parameters:openrouter-api-key=test-key", "--Parameters:playground-events-enabled=true"]);
        await using var app = await builder.BuildAsync();
        var web = builder.Resources.OfType<IResourceWithEnvironment>().Single(resource => resource.Name == "web-nuxt");

        var env = await web.GetEnvironmentVariableValuesAsync(DistributedApplicationOperation.Run);

        await Assert.That(env["NUXT_PUBLIC_PLAYGROUND_EVENTS_ENABLED"]).IsEqualTo("true");
    }

    private static async Task<Dictionary<string, string>> ApiEnvironment(params string[] args)
    {
        var builder = await DistributedApplicationTestingBuilder.CreateAsync<Projects.TsiaCoach_AppHost>(args);
        await using var app = await builder.BuildAsync();
        var api = builder.Resources.OfType<ProjectResource>().Single(resource => resource.Name == "api");
        return await api.GetEnvironmentVariableValuesAsync(DistributedApplicationOperation.Run);
    }
}
