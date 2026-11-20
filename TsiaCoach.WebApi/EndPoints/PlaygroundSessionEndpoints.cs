using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using TsiaCoach.Domain.Attempts;
using TsiaCoach.WebApi.Attempts;
using TsiaCoach.WebApi.PlaygroundEvents;
using TsiaCoach.WebApi.Request;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.EndPoints;

/// <summary>
/// Learner action log. The Nuxt server validates each payload against the shared
/// schema first; these checks repeat its limits so the API never trusts its caller.
/// Reads, export and deletion are API-only: Nuxt proxies just session start and append.
/// </summary>
public static partial class PlaygroundSessionEndpoints
{
    public const int MaxEventsPerBatch = 100;
    public const int MaxReasonLength = 200;
    public const int MaxDataBytes = 4 * 1024;
    public const int MaxSceneSummaryEntries = 40;
    public const int MaxReadLimit = 1_000;

    public static readonly IReadOnlySet<string> Playgrounds = new HashSet<string>(StringComparer.Ordinal)
    {
        "bar-rod", "array-rod", "fraction-rod", "math-tabla", "systems",
        "rod-count-systems", "base-ten", "algebra-tiles", "scaffold", "rod-canvas"
    };

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$")]
    private static partial Regex Token();

    [GeneratedRegex("^[A-Za-z0-9_.:-]{1,128}$")]
    private static partial Regex Link();

    [GeneratedRegex("^[0-9a-f]{32}$")]
    private static partial Regex TraceId();

    public static RouteGroupBuilder MapPlaygroundSessions(this RouteGroupBuilder api)
    {
        RouteGroupBuilder sessions = api.MapGroup("/playground-sessions").WithTags("PlaygroundSessions");

        sessions.MapPost("/", Start)
            .WithName("StartPlaygroundSession")
            .Produces<PlaygroundSessionResponse>(StatusCodes.Status201Created)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);

        sessions.MapPost("/{sessionId}/events", Append)
            .WithName("AppendPlaygroundEvents")
            .Produces<AppendPlaygroundEventsResponse>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);

        sessions.MapGet("/{sessionId}/events", Read)
            .WithName("GetPlaygroundEvents")
            .Produces<PlaygroundEventsResponse>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);

        sessions.MapGet("/{sessionId}/summary", Summary)
            .WithName("GetPlaygroundEventSummary")
            .Produces<PlaygroundEventSummary>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);

        sessions.MapGet("/{sessionId}/export", ExportOne)
            .WithName("ExportPlaygroundSession")
            .Produces<PlaygroundSessionExport>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);

        sessions.MapDelete("/{sessionId}", Delete)
            .WithName("DeletePlaygroundSession")
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);

        sessions.MapGet("/export", ExportAll)
            .WithName("ExportPlaygroundSessions")
            .Produces(StatusCodes.Status200OK, contentType: "application/x-ndjson")
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);

        return api;
    }

    private static ProblemDetails Problem(int status, string title) => new() { Status = status, Title = title };

    private static NotFound<ProblemDetails> SessionNotFound() =>
        TypedResults.NotFound(Problem(StatusCodes.Status404NotFound, "Playground session not found."));

    private static async Task<Results<Created<PlaygroundSessionResponse>, BadRequest<ProblemDetails>, NotFound<ProblemDetails>>> Start(
        StartPlaygroundSessionRequest request,
        IPlaygroundEventStore store,
        InMemoryAttemptStore attempts,
        CancellationToken cancellationToken)
    {
        if (!Playgrounds.Contains(request.Playground))
        {
            return TypedResults.BadRequest(Problem(StatusCodes.Status400BadRequest, "Unknown playground."));
        }

        foreach (string? link in new[] { request.AttemptId, request.ScaffoldSessionId, request.LevelId })
        {
            if (link is not null && !Link().IsMatch(link))
            {
                return TypedResults.BadRequest(Problem(StatusCodes.Status400BadRequest, "Invalid session link."));
            }
        }

        if (request.Consent is not (null or "granted"))
        {
            return TypedResults.BadRequest(Problem(StatusCodes.Status400BadRequest, "Consent must be \"granted\" when given."));
        }

        // A session may only claim an attempt that exists.
        if (request.AttemptId is not null && !attempts.TryGet(new AttemptId(request.AttemptId), out _))
        {
            return TypedResults.NotFound(Problem(StatusCodes.Status404NotFound, "Attempt not found."));
        }

        PlaygroundSession session = await store.StartAsync(
            new StartPlaygroundSession(request.Playground, request.AttemptId, request.ScaffoldSessionId, request.LevelId, request.Consent),
            cancellationToken);
        return TypedResults.Created(
            $"/api/playground-sessions/{session.Id}",
            new PlaygroundSessionResponse(session.Id));
    }

    private static async Task<Results<Ok<AppendPlaygroundEventsResponse>, BadRequest<ProblemDetails>, NotFound<ProblemDetails>, Conflict<ProblemDetails>>> Append(
        string sessionId,
        AppendPlaygroundEventsRequest request,
        IPlaygroundEventStore store,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        if (await store.FindSessionAsync(sessionId, cancellationToken) is not { } session)
        {
            return SessionNotFound();
        }

        if (Validate(sessionId, session, request) is { } error)
        {
            return TypedResults.BadRequest(Problem(StatusCodes.Status400BadRequest, error));
        }

        DateTimeOffset received = timeProvider.GetUtcNow();
        PlaygroundEventRecord[] records = request.Events
            .Select(item => new PlaygroundEventRecord(
                item.Id.ToLowerInvariant(),
                session.Id,
                session.Playground,
                item.Seq,
                item.At,
                item.TraceId,
                item.Type,
                item.Outcome,
                item.Reason,
                item.Data.Clone(),
                item.SceneSummary is null ? null : new Dictionary<string, int>(item.SceneSummary, StringComparer.Ordinal),
                received))
            .ToArray();

        AppendPlaygroundEventsResult result = await store.AppendAsync(session.Id, records, cancellationToken);
        return result.Kind switch
        {
            AppendPlaygroundEventsResultKind.Appended =>
                TypedResults.Ok(new AppendPlaygroundEventsResponse(result.Accepted, result.Duplicates)),
            AppendPlaygroundEventsResultKind.UnknownSession => SessionNotFound(),
            AppendPlaygroundEventsResultKind.SessionFull =>
                TypedResults.Conflict(Problem(StatusCodes.Status409Conflict, "Playground session is full.")),
            _ => throw new InvalidOperationException("Unsupported append result.")
        };
    }

    /// <summary>The first problem with a batch, or null when it is acceptable.</summary>
    public static string? Validate(string sessionId, PlaygroundSession session, AppendPlaygroundEventsRequest request)
    {
        if (!string.Equals(request.SessionId, sessionId, StringComparison.Ordinal))
            return "The batch belongs to another session.";
        if (request.Events is not { Count: > 0 and <= MaxEventsPerBatch })
            return $"Send between 1 and {MaxEventsPerBatch} events.";

        foreach (PlaygroundEventRequest item in request.Events)
        {
            if (item.Id is not { Length: 36 } || !Guid.TryParseExact(item.Id, "D", out _))
                return "Event IDs must be UUIDs.";
            if (!string.Equals(item.SessionId, sessionId, StringComparison.Ordinal))
                return "Every event must belong to the batch session.";
            if (!string.Equals(item.Playground, session.Playground, StringComparison.Ordinal))
                return "Events must come from the session's playground.";
            if (item.Seq < 0)
                return "Event sequence numbers cannot be negative.";
            if (item.Type is null || !Token().IsMatch(item.Type))
                return "Invalid event type.";
            if (item.Outcome is not ("applied" or "rejected"))
                return "Event outcome must be applied or rejected.";
            if (item.Reason is { Length: 0 or > MaxReasonLength })
                return $"Rejection reasons must be 1 to {MaxReasonLength} characters.";
            if (item.TraceId is not null && !TraceId().IsMatch(item.TraceId))
                return "Invalid trace ID.";
            if (item.Data.ValueKind != JsonValueKind.Object || item.Data.GetRawText().Length > MaxDataBytes)
                return "Event data must be a small JSON object.";
            if (item.SceneSummary is { } summary &&
                (summary.Count > MaxSceneSummaryEntries || summary.Keys.Any(key => !Token().IsMatch(key))))
                return "Invalid scene summary.";
        }

        return null;
    }

    private static async Task<Results<Ok<PlaygroundEventsResponse>, NotFound<ProblemDetails>>> Read(
        string sessionId,
        IPlaygroundEventStore store,
        CancellationToken cancellationToken,
        long? since = null,
        int? limit = null)
    {
        if (await store.FindSessionAsync(sessionId, cancellationToken) is not { } session)
        {
            return SessionNotFound();
        }

        int take = Math.Clamp(limit ?? MaxReadLimit, 0, MaxReadLimit);
        return TypedResults.Ok(new PlaygroundEventsResponse(
            session.Id,
            session.Playground,
            await store.ReadAsync(session.Id, since, take, cancellationToken)));
    }

    private static async Task<Results<Ok<PlaygroundEventSummary>, NotFound<ProblemDetails>>> Summary(
        string sessionId,
        IPlaygroundEventStore store,
        CancellationToken cancellationToken)
    {
        if (await store.FindSessionAsync(sessionId, cancellationToken) is not { } session)
        {
            return SessionNotFound();
        }

        return TypedResults.Ok(PlaygroundEventSummaryProjector.Project(
            session,
            await store.ReadAsync(session.Id, cancellationToken: cancellationToken)));
    }

    private static async Task<Results<Ok<PlaygroundSessionExport>, NotFound<ProblemDetails>>> ExportOne(
        string sessionId,
        IPlaygroundEventStore store,
        CancellationToken cancellationToken)
    {
        if (await store.FindSessionAsync(sessionId, cancellationToken) is not { } session)
        {
            return SessionNotFound();
        }

        return TypedResults.Ok(new PlaygroundSessionExport(
            session,
            await store.ReadAsync(session.Id, cancellationToken: cancellationToken)));
    }

    private static async Task<Results<NoContent, NotFound<ProblemDetails>>> Delete(
        string sessionId,
        IPlaygroundEventStore store,
        CancellationToken cancellationToken) =>
        await store.DeleteSessionAsync(sessionId, cancellationToken)
            ? TypedResults.NoContent()
            : SessionNotFound();

    /// <summary>One JSON line per session, with its events, for sessions started in [from, to).</summary>
    private static Results<BadRequest<ProblemDetails>, PushStreamHttpResult> ExportAll(
        IPlaygroundEventStore store,
        IOptions<Microsoft.AspNetCore.Http.Json.JsonOptions> jsonOptions,
        HttpContext context,
        DateTimeOffset? from = null,
        DateTimeOffset? to = null)
    {
        if (from is not null && to is not null && from >= to)
        {
            return TypedResults.BadRequest(Problem(StatusCodes.Status400BadRequest, "\"from\" must be before \"to\"."));
        }

        JsonSerializerOptions serializer = jsonOptions.Value.SerializerOptions;
        return TypedResults.Stream(async stream =>
        {
            CancellationToken aborted = context.RequestAborted;
            await foreach (PlaygroundSessionExport export in Exports(store, from, to, aborted))
            {
                await JsonSerializer.SerializeAsync(stream, export, serializer, aborted);
                await stream.WriteAsync("\n"u8.ToArray(), aborted);
                await stream.FlushAsync(aborted);
            }
        }, "application/x-ndjson");
    }

    private static async IAsyncEnumerable<PlaygroundSessionExport> Exports(
        IPlaygroundEventStore store,
        DateTimeOffset? from,
        DateTimeOffset? to,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        await foreach (PlaygroundSession session in store.ListSessionsAsync(from, to, cancellationToken))
        {
            yield return new PlaygroundSessionExport(
                session,
                await store.ReadAsync(session.Id, cancellationToken: cancellationToken));
        }
    }
}
