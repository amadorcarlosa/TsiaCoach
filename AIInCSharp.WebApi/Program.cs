
using System.Text.Json;
using System.Text.Json.Serialization;
using AIInCSharp.WebApi.EndPoints;
using OpenAI.Responses;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));
builder.AddServiceDefaults();

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
app.Run();







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
using AIInCSharp;
using AIInCSharp.WebApi;
using AIInCSharp.WebApi.Agents;
using Anthropic.Foundry;
using static AIInCSharp.WebApi.Agents.Models;

Output.Title("Agent Framework: All In C Sharp");
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