#pragma warning disable ASPIREJAVASCRIPT001

var builder = DistributedApplication.CreateBuilder(args);

var openRouterKey = builder.AddParameter("openrouter-api-key", secret: true);

var api =
    builder.AddProject<Projects.TsiaCoach_WebApi>("api")
        .WithEnvironment("OpenRouter__ApiKey", openRouterKey)
        .WithHttpHealthCheck("/health");




var web = builder.AddViteApp("web-nuxt", "../tsia-coach-web-nuxt")
    .WithPnpm()
    .WithEnvironment("NUXT_API_URL", api.GetEndpoint("http"))
    .WithHttpEndpoint(port: 3000, env: "PORT")
    .WaitFor(api);

builder.Build().Run();
