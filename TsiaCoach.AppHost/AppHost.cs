#pragma warning disable ASPIREJAVASCRIPT001

var builder = DistributedApplication.CreateBuilder(args);

var api =
    builder.AddProject<Projects.TsiaCoach_WebApi>("api")
        .WithHttpHealthCheck("/health");




var web = builder.AddViteApp("web-nuxt", "../tsia-coach-web-nuxt")
    .WithPnpm()
    .WithEnvironment("NUXT_API_URL", api.GetEndpoint("http"))
    .WaitFor(api);

builder.Build().Run();
