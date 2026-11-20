using Microsoft.Extensions.Options;
using Turso.Serverless.Client;

namespace TsiaCoach.WebApi.PlaygroundEvents;

public sealed class PlaygroundEventOptions
{
    public const string Section = "PlaygroundEvents";

    public string Store { get; set; } = "InMemory";

    /// <summary>Sessions older than this are deleted with their events. Zero or less keeps everything.</summary>
    public int RetentionDays { get; set; } = 180;

    public TimeSpan RetentionSweepInterval { get; set; } = TimeSpan.FromDays(1);

    /// <summary>Session starts allowed per minute across the API. Zero or less turns the limit off.</summary>
    public int SessionStartsPerMinute { get; set; } = 1_200;

    public TursoOptions Turso { get; set; } = new();
}

public sealed class TursoOptions
{
    public string? Url { get; set; }

    public string? AuthToken { get; set; }
}

public sealed class TursoConnectionFactory
{
    private readonly HttpClient http;
    private readonly TursoServerlessConnectionOptions connectionOptions;

    public TursoConnectionFactory(HttpClient http, IOptions<PlaygroundEventOptions> options)
    {
        this.http = http;
        TursoOptions turso = options.Value.Turso;
        if (!Uri.TryCreate(turso.Url?.Trim(), UriKind.Absolute, out Uri? url)
            || url.Scheme is not ("turso" or "libsql" or "https" or "http")
            || url.Host.Length == 0 || url.UserInfo.Length != 0 || url.Query.Length != 0 || url.Fragment.Length != 0)
        {
            throw new InvalidOperationException("PlaygroundEvents:Turso:Url must be a Turso database base URL.");
        }

        if (url.Scheme is "turso" or "libsql")
        {
            url = new UriBuilder(url) { Scheme = Uri.UriSchemeHttps, Port = url.Port }.Uri;
        }

        string? token = string.IsNullOrWhiteSpace(turso.AuthToken) ? null : turso.AuthToken.Trim();
        if (token is not null && url.Scheme == Uri.UriSchemeHttp && !url.IsLoopback)
        {
            throw new InvalidOperationException("Use HTTPS for a remote Turso database with an auth token.");
        }
        if (token is null && url.Host.EndsWith(".turso.io", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Set PlaygroundEvents:Turso:AuthToken for the Turso Cloud database.");
        }

        connectionOptions = new TursoServerlessConnectionOptions
        {
            Url = url.AbsoluteUri.TrimEnd('/'),
            AuthToken = token,
            DefaultQueryTimeout = TimeSpan.FromSeconds(30),
        };
    }

    // A connection holds the server's transaction state. Each store operation gets its own.
    public TursoServerlessConnection CreateConnection() => new(connectionOptions, http);
}
