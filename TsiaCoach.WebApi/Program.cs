using System.Text.Json;
using System.Text.Json.Serialization;
using TsiaCoach.WebApi;
using TsiaCoach.WebApi.Agents;
using TsiaCoach.WebApi.EndPoints;
using TsiaCoach.WebApi.Attempts;
using TsiaCoach.WebApi.CoachingAgents;
using TsiaCoach.WebApi.ScaffoldSessions;
using Azure.Core;
using Azure.Identity;

var builder = WebApplication.CreateBuilder(args);

string? endpoint = builder.Configuration["endpoint"];
if (string.IsNullOrWhiteSpace(endpoint))
{
    throw new InvalidOperationException("Endpoint is not configured.");
}
string? foundryResource = builder.Configuration["foundryResource"];
if (string.IsNullOrWhiteSpace(foundryResource))
{
    throw new InvalidOperationException("Foundry resource is not configured.");
}
string? tenantId = builder.Configuration["tenantId"];
builder.Services.AddSingleton<TokenCredential>(new ChainedTokenCredential(
    new AzureCliCredential(new AzureCliCredentialOptions { TenantId = tenantId }),
    new EnvironmentCredential()));
builder.Services.AddSingleton(sp =>
    new FoundryTokenCredential(sp.GetRequiredService<TokenCredential>(), foundryResource));

builder.Services.AddSingleton<ModelClient>(sp =>
{
    var config = new ModelConfig(
        new AzureOpenAIConfig(new Uri(endpoint), sp.GetRequiredService<TokenCredential>()),
        new AzureAnthropicModelConfig(sp.GetRequiredService<FoundryTokenCredential>()));

    return config.CreateModelClient() switch
    {
        ModelClient created => created,
        AgentError error => throw new InvalidOperationException(
            $"Failed to create model clients: {error}")
    };
});
builder.Services.AddSingleton<AgentFactory>();
builder.Services.AddSingleton<IAgentExecutor, AgentExecutor>();
builder.Services.AddOptions<CoachingAgentOptions>()
    .Bind(builder.Configuration.GetSection("CoachingAgent"));
builder.Services.AddSingleton<CoachingAgentDefinitionFactory>();
builder.Services.AddSingleton<ICoachingAgentRunner, CoachingAgentRunner>();
builder.Services.AddSingleton<CoachingTurnService>();
builder.Services.AddProblemDetails();
builder.Services.AddSingleton<TimeProvider>(TimeProvider.System);
builder.Services.AddSingleton<SamplePracticeCatalog>();
builder.Services.AddSingleton<InMemoryAttemptStore>();
builder.Services.AddSingleton<InMemoryScaffoldSessionStore>();
builder.Services.AddSingleton<ScaffoldSessionService>();

builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.AllowOutOfOrderMetadataProperties = true;
    options.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter(
            JsonNamingPolicy.CamelCase,
            allowIntegerValues: false));
});
builder.AddServiceDefaults();
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing =>
        tracing.AddSource(AgentTelemetry.SourceName))
    .WithMetrics(metrics =>
        metrics.AddMeter(AgentTelemetry.SourceName));

var app = builder.Build();
// Configure the HTTP request pipeline.


if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseExceptionHandler();
}
app.MapGet("/", () => "Hello World!");
app.MapGet("/health", () => Results.Ok("healthy"));
var api = app.MapGroup("/api");
api.MapModels();
api.MapAgents();
api.MapSampleQuestions();
api.MapPracticeItems(app.Services.GetRequiredService<SamplePracticeCatalog>());
api.MapAttempts(
    app.Services.GetRequiredService<SamplePracticeCatalog>(),
    app.Services.GetRequiredService<InMemoryAttemptStore>());
api.MapCoaching();
api.MapScaffolds(app.Services.GetRequiredService<SamplePracticeCatalog>());
api.MapScaffoldSessions(app.Services.GetRequiredService<ScaffoldSessionService>());
app.Run();

namespace TsiaCoach.WebApi
{
    public partial class Program;
}





/*using Azure;
using Azure.AI.OpenAI;
using Azure.Core;
using Azure.Core.Diagnostics;
using Azure.Identity;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Configuration;
using OpenAI.Chat;
using System;
using TsiaCoach;
using TsiaCoach.WebApi;
using TsiaCoach.WebApi.Agents;
using Anthropic.Foundry;
using static TsiaCoach.WebApi.Agents.Models;

Output.Title("Agent Framework: TsiaCoach");
Output.Separator();

using var listener = AzureEventSourceListener.CreateConsoleLogger();

IConfigurationRoot configuration = new ConfigurationBuilder().AddUserSecrets<Program>().Build();

using var appCts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    appCts.Cancel();
};




string? endpoint = configuration["endpoint"];
if (string.IsNullOrWhiteSpace(endpoint))
{
    throw new InvalidOperationException("Endpoint is not configured.");
}
string? foundryResource=configuration["foundryResource"];

string? tenantId = configuration["tenantId"];
TokenCredential credential = new ChainedTokenCredential(
    new AzureCliCredential(new AzureCliCredentialOptions { TenantId = tenantId }),
    new EnvironmentCredential(),
    new InteractiveBrowserCredential(new InteractiveBrowserCredentialOptions
    {
        TenantId = tenantId,
        TokenCachePersistenceOptions = new TokenCachePersistenceOptions()
    })
);

const string Scope = "https://cognitiveservices.azure.com/.default";
try
{
    using var authCts = new CancellationTokenSource(TimeSpan.FromSeconds(60));
    AccessToken token = await credential.GetTokenAsync(
        new TokenRequestContext(new[] { Scope }),
        authCts.Token
    );

    Output.Green($"Auth OK, token expires {token.ExpiresOn:u}");
}
catch (OperationCanceledException)
{
    Output.Red("Auth timed out (interactive browser login probably never completed).");
    return;
}
catch (AuthenticationFailedException ex)
{
    Output.Red($"Auth failed: {ex.Message}");
    return;
}

if (foundryResource is null)
{
    Output.Red("No foundryResource found.");
    return;
}
FoundryTokenCredential? foundryTokenCredential = new FoundryTokenCredential(credential, foundryResource);

Console.Write("Enter instructions> ");
string instructions = Console.ReadLine() ?? "";

if (appCts.IsCancellationRequested)
{
    Output.Red("Canceled.");
    return;
}

var anthropicConfig = new AzureAnthropicModelConfig(foundryTokenCredential);
var azureOpenAiConfig = new AzureOpenAIConfig(new Uri(endpoint), credential);
ModelConfig config = new ModelConfig(azureOpenAiConfig, anthropicConfig);


ModelClient client = config.CreateModelClient() switch
{
    ModelClient created => created,

    AgentError error =>
        throw new InvalidOperationException(
            $"Failed to create model clients: {error}")
};

await Instructions.RunSample(client);


*/
