#pragma warning disable ASPIREJAVASCRIPT001

using Aspire.Hosting.Publishing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

var builder = DistributedApplication.CreateBuilder(args);

// The AppHost owns the API's provider settings and secrets. Set local values with
// `aspire secret set Parameters:<name> <value>`; deployments supply the same parameters.
var aiEnabled = Setting("ai-enabled", "true", "Set to false to run the API without an AI provider.");
var agentProvider = Setting("agent-provider", "Foundry", "Chat provider: Foundry or OpenRouter.");
var openRouterKey = builder.AddParameter("openrouter-api-key", secret: true)
    .WithDescription("OpenRouter API key for OpenRouter chat and Jev decisions.");
var openRouterModels = Setting("openrouter-models", "", "Comma-separated OpenRouter chat model IDs. The first one coaches.");
var foundryEndpoint = Setting("foundry-endpoint", "", "Azure OpenAI endpoint for Foundry mode.");
var foundryResource = Setting("foundry-resource", "", "Foundry resource name for Anthropic models in Foundry mode.");
var azureTenantId = Setting("azure-tenant-id", "", "Optional Azure tenant for Azure CLI sign-in in Foundry mode.");
var playgroundEventsEnabled = Setting("playground-events-enabled", "false",
    "Set to true to record playground actions (after learner consent) in the action log.");

var api =
    builder.AddProject<Projects.TsiaCoach_WebApi>("api")
        .WithEnvironment("AI__Enabled", aiEnabled)
        .WithEnvironment("AgentProvider", agentProvider)
        .WithEnvironment("OpenRouter__ApiKey", openRouterKey)
        .WithEnvironment("OpenRouter__Models", openRouterModels)
        .WithEnvironment("endpoint", foundryEndpoint)
        .WithEnvironment("foundryResource", foundryResource)
        .WithEnvironment("tenantId", azureTenantId)
        .WithHttpHealthCheck("/health");

if (builder.ExecutionContext.IsPublishMode || !string.IsNullOrWhiteSpace(builder.Configuration["Parameters:turso-url"]))
{
    var tursoUrl = builder.AddParameter("turso-url")
        .WithDescription("Turso database HTTPS URL for the playground action log.");
    var tursoToken = builder.AddParameter("turso-auth-token", secret: true)
        .WithDescription("Turso database token.");
    api.WithEnvironment("PlaygroundEvents__Store", "Turso")
        .WithEnvironment("PlaygroundEvents__Turso__Url", tursoUrl)
        .WithEnvironment("PlaygroundEvents__Turso__AuthToken", tursoToken);
}
else
{
    api.WithEnvironment("PlaygroundEvents__Store", "InMemory")
        .OnBeforeResourceStarted((resource, context, _) =>
        {
            var logger = context.Services.GetRequiredService<ResourceLoggerService>().GetLogger(resource);
            logger.LogInformation("Playground events use in-memory storage for this run. Set Parameters:turso-url to persist events across API restarts.");
            return Task.CompletedTask;
        });
}

var web = builder.AddViteApp("web-nuxt", "../tsia-coach-web-nuxt")
    .WithPnpm()
    .WithOtlpExporter(OtlpProtocol.HttpProtobuf)
    .WithEnvironment("NUXT_PUBLIC_TELEMETRY_ENABLED", "true")
    .WithEnvironment("NUXT_PUBLIC_PLAYGROUND_EVENTS_ENABLED", playgroundEventsEnabled)
    .WithEnvironment("NUXT_API_URL", api.GetEndpoint("http"))
    .WithHttpEndpoint(port: 3000, env: "PORT")
    .WaitFor(api);

builder.Build().Run();

// A plain setting: Parameters:<name> from configuration wins, otherwise the default applies.
IResourceBuilder<ParameterResource> Setting(string name, string defaultValue, string description) =>
    builder.AddParameter(name, new ConstantParameterDefault(defaultValue)).WithDescription(description);

sealed class ConstantParameterDefault(string value) : ParameterDefault
{
    public override string GetDefaultValue() => value;

    public override void WriteToManifest(ManifestPublishingContext context) =>
        context.Writer.WriteString("value", value);
}
