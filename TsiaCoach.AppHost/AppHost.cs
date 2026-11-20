#pragma warning disable ASPIREJAVASCRIPT001

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

var builder = DistributedApplication.CreateBuilder(args);

var openRouterKey = builder.AddParameter("openrouter-api-key", secret: true);

var api =
    builder.AddProject<Projects.TsiaCoach_WebApi>("api")
        .WithEnvironment("OpenRouter__ApiKey", openRouterKey)
        .WithHttpHealthCheck("/health");

if (builder.ExecutionContext.IsPublishMode || !string.IsNullOrWhiteSpace(builder.Configuration["Turso:Url"]))
{
    var tursoUrl = builder.AddParameterFromConfiguration("turso-url", "Turso:Url");
    var tursoToken = builder.AddParameter("turso-auth-token", secret: true);
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
            logger.LogInformation("Playground events use in-memory storage for this run. Set Turso:Url to persist events across API restarts.");
            return Task.CompletedTask;
        });
}

var web = builder.AddViteApp("web-nuxt", "../tsia-coach-web-nuxt")
    .WithPnpm()
    .WithOtlpExporter(OtlpProtocol.HttpProtobuf)
    .WithEnvironment("NUXT_PUBLIC_TELEMETRY_ENABLED", "true")
    .WithEnvironment("NUXT_API_URL", api.GetEndpoint("http"))
    .WithHttpEndpoint(port: 3000, env: "PORT")
    .WaitFor(api);

builder.Build().Run();
