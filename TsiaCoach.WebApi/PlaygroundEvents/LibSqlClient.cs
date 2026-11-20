using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace TsiaCoach.WebApi.PlaygroundEvents;

public sealed class PlaygroundEventOptions
{
    public const string Section = "PlaygroundEvents";

    /// <summary>"InMemory" (default) or "Turso".</summary>
    public string Store { get; set; } = "InMemory";

    /// <summary>Sessions older than this are deleted with their events. Zero or less keeps everything.</summary>
    public int RetentionDays { get; set; } = 180;

    public TimeSpan RetentionSweepInterval { get; set; } = TimeSpan.FromDays(1);

    public TursoOptions Turso { get; set; } = new();
}

public sealed class TursoOptions
{
    /// <summary>A Turso database URL (libsql://, https://) or a local libSQL server (http://host:8080).</summary>
    public string? Url { get; set; }

    /// <summary>A Turso database token. Local libSQL servers need none.</summary>
    public string? AuthToken { get; set; }
}

public sealed class LibSqlException(string message, string? code) : Exception(message)
{
    public string? Code { get; } = code;
}

/// <summary>One SQL statement with positional arguments: string, long, int, double, bool or null.</summary>
public sealed record LibSqlStatement(string Sql, params object?[] Args);

public sealed record LibSqlResult(
    IReadOnlyList<string> Columns,
    IReadOnlyList<IReadOnlyList<object?>> Rows,
    long AffectedRows);

/// <summary>
/// The libSQL remote protocol over HTTP (<c>POST /v2/pipeline</c>), which Turso
/// and the open-source libSQL server both speak. Each call is one pipeline:
/// statements run in order on one stream, which is then closed.
/// </summary>
public sealed class LibSqlClient(HttpClient http, IOptions<PlaygroundEventOptions> options)
{
    public static Uri PipelineUri(string url)
    {
        string normalized = url.Trim();
        if (normalized.StartsWith("libsql://", StringComparison.OrdinalIgnoreCase))
        {
            normalized = "https://" + normalized["libsql://".Length..];
        }

        return new Uri(normalized.TrimEnd('/') + "/v2/pipeline");
    }

    public async Task<IReadOnlyList<LibSqlResult>> ExecuteAsync(
        IReadOnlyList<LibSqlStatement> statements,
        CancellationToken cancellationToken = default)
    {
        TursoOptions turso = options.Value.Turso;
        if (string.IsNullOrWhiteSpace(turso.Url))
        {
            throw new InvalidOperationException("PlaygroundEvents:Turso:Url is not configured.");
        }

        JsonArray requests = [];
        foreach (LibSqlStatement statement in statements)
        {
            requests.Add(new JsonObject
            {
                ["type"] = "execute",
                ["stmt"] = new JsonObject
                {
                    ["sql"] = statement.Sql,
                    ["args"] = new JsonArray(statement.Args.Select(Encode).ToArray<JsonNode?>()),
                },
            });
        }

        requests.Add(new JsonObject { ["type"] = "close" });

        using HttpRequestMessage request = new(HttpMethod.Post, PipelineUri(turso.Url))
        {
            Content = JsonContent.Create(new JsonObject { ["requests"] = requests }),
        };
        if (!string.IsNullOrWhiteSpace(turso.AuthToken))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", turso.AuthToken);
        }

        using HttpResponseMessage response = await http.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new LibSqlException($"libSQL returned HTTP {(int)response.StatusCode}.", null);
        }

        using JsonDocument body = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync(cancellationToken),
            cancellationToken: cancellationToken);

        List<LibSqlResult> results = [];
        JsonElement items = body.RootElement.GetProperty("results");
        for (int index = 0; index < statements.Count; index++)
        {
            JsonElement item = items[index];
            if (item.GetProperty("type").GetString() != "ok")
            {
                JsonElement error = item.GetProperty("error");
                throw new LibSqlException(
                    error.GetProperty("message").GetString() ?? "libSQL statement failed.",
                    error.TryGetProperty("code", out JsonElement code) ? code.GetString() : null);
            }

            JsonElement result = item.GetProperty("response").GetProperty("result");
            results.Add(new LibSqlResult(
                result.GetProperty("cols").EnumerateArray()
                    .Select(column => column.GetProperty("name").GetString() ?? "")
                    .ToArray(),
                result.GetProperty("rows").EnumerateArray()
                    .Select(row => (IReadOnlyList<object?>)row.EnumerateArray().Select(Decode).ToArray())
                    .ToArray(),
                result.GetProperty("affected_row_count").GetInt64()));
        }

        return results;
    }

    public static JsonObject Encode(object? value) => value switch
    {
        null => new JsonObject { ["type"] = "null" },
        string text => new JsonObject { ["type"] = "text", ["value"] = text },
        bool flag => new JsonObject { ["type"] = "integer", ["value"] = flag ? "1" : "0" },
        int number => new JsonObject { ["type"] = "integer", ["value"] = number.ToString(CultureInfo.InvariantCulture) },
        long number => new JsonObject { ["type"] = "integer", ["value"] = number.ToString(CultureInfo.InvariantCulture) },
        double number => new JsonObject { ["type"] = "float", ["value"] = number },
        _ => throw new ArgumentException($"Unsupported libSQL argument type {value.GetType().Name}.", nameof(value)),
    };

    public static object? Decode(JsonElement value) => value.GetProperty("type").GetString() switch
    {
        "null" => null,
        "integer" => long.Parse(value.GetProperty("value").GetString()!, CultureInfo.InvariantCulture),
        "float" => value.GetProperty("value").GetDouble(),
        "text" => value.GetProperty("value").GetString(),
        "blob" => Convert.FromBase64String(value.GetProperty("base64").GetString() ?? ""),
        string other => throw new LibSqlException($"Unsupported libSQL value type '{other}'.", null),
        null => throw new LibSqlException("A libSQL value had no type.", null),
    };
}
