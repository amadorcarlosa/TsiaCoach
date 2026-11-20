#pragma warning disable ASPIREJAVASCRIPT001

var builder = DistributedApplication.CreateBuilder(args);

var openRouterKey = builder.AddParameter("openrouter-api-key", secret: true);

// Learner action log (docs/architecture/playground-event-log-plan.md). With
// Turso:Url set (for example libsql://<db>-<org>.turso.io) the API uses that
// Turso database and the turso-auth-token secret; otherwise a local libSQL
// server, which speaks the same protocol, keeps its data in a named volume.
string? tursoUrl = builder.Configuration["Turso:Url"];

var api =
    builder.AddProject<Projects.TsiaCoach_WebApi>("api")
        .WithEnvironment("OpenRouter__ApiKey", openRouterKey)
        .WithEnvironment("PlaygroundEvents__Store", "Turso")
        .WithHttpHealthCheck("/health");

if (string.IsNullOrWhiteSpace(tursoUrl))
{
    var libsql = builder.AddContainer("libsql", "ghcr.io/tursodatabase/libsql-server", "v0.24.33")
        .WithHttpEndpoint(targetPort: 8080, name: "http")
        .WithVolume("tsia-libsql-data", "/var/lib/sqld");
    api.WithEnvironment("PlaygroundEvents__Turso__Url", libsql.GetEndpoint("http"))
        .WaitFor(libsql);
}
else
{
    var tursoToken = builder.AddParameter("turso-auth-token", secret: true);
    api.WithEnvironment("PlaygroundEvents__Turso__Url", tursoUrl)
        .WithEnvironment("PlaygroundEvents__Turso__AuthToken", tursoToken);
}




var web = builder.AddViteApp("web-nuxt", "../tsia-coach-web-nuxt")
    .WithPnpm()
    .WithOtlpExporter(OtlpProtocol.HttpProtobuf)
    .WithEnvironment("NUXT_PUBLIC_TELEMETRY_ENABLED", "true")
    .WithEnvironment("NUXT_API_URL", api.GetEndpoint("http"))
    .WithHttpEndpoint(port: 3000, env: "PORT")
    .WaitFor(api);

builder.Build().Run();
