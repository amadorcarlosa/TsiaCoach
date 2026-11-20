using System.Text.Json;
using System.Text.Json.Serialization;

namespace TsiaCoach.WebApi.Request;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record StartPlaygroundSessionRequest(
    string Playground,
    string? AttemptId = null,
    string? ScaffoldSessionId = null,
    string? LevelId = null,
    string? Consent = null);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record AppendPlaygroundEventsRequest(
    string SessionId,
    IReadOnlyList<PlaygroundEventRequest> Events);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record PlaygroundEventRequest(
    string Id,
    string SessionId,
    string Playground,
    long Seq,
    DateTimeOffset At,
    string Type,
    string Outcome,
    JsonElement Data,
    string? TraceId = null,
    string? Reason = null,
    Dictionary<string, int>? SceneSummary = null);
