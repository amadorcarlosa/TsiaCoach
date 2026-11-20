using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TsiaCoach.WebApi.PlaygroundEvents;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

/// <summary>
/// One contract for every store. The Turso cases run when TSIA_LIBSQL_URL names a
/// libSQL server (for example a local ghcr.io/tursodatabase/libsql-server container).
/// </summary>
internal sealed class ManualTimeProvider(DateTimeOffset start) : TimeProvider
{
    private DateTimeOffset now = start;

    public override DateTimeOffset GetUtcNow() => now;

    public void Advance(TimeSpan by) => now += by;
}

public sealed class PlaygroundEventStoreTests
{
    private static readonly JsonElement EmptyData = JsonDocument.Parse("{}").RootElement.Clone();

    internal static PlaygroundEventRecord Event(
        string sessionId,
        long seq,
        string type = "tile.moved",
        string outcome = "applied",
        string? reason = null,
        string? id = null,
        DateTimeOffset? at = null) => new(
            id ?? Guid.NewGuid().ToString("D"),
            sessionId,
            "algebra-tiles",
            seq,
            at ?? DateTimeOffset.UnixEpoch.AddSeconds(seq),
            null,
            type,
            outcome,
            reason,
            EmptyData,
            null,
            DateTimeOffset.UnixEpoch);

    internal static IPlaygroundEventStore Store(string kind, TimeProvider? time = null)
    {
        time ??= TimeProvider.System;
        if (kind == "memory") return new InMemoryPlaygroundEventStore(time);
        string? url = Environment.GetEnvironmentVariable("TSIA_LIBSQL_URL");
        Skip.Unless(!string.IsNullOrWhiteSpace(url), "Set TSIA_LIBSQL_URL to run the Turso store tests.");
        var options = Options.Create(new PlaygroundEventOptions
        {
            Store = "Turso",
            Turso = new TursoOptions { Url = url, AuthToken = Environment.GetEnvironmentVariable("TSIA_LIBSQL_TOKEN") },
        });
        return new TursoPlaygroundEventStore(new LibSqlClient(new HttpClient(), options), time);
    }

    [Test]
    [Arguments("memory")]
    [Arguments("turso")]
    public async Task Append_IgnoresRepeatedEventIds(string kind)
    {
        IPlaygroundEventStore store = Store(kind);
        PlaygroundSession session = await store.StartAsync(new StartPlaygroundSession("algebra-tiles"));
        PlaygroundEventRecord first = Event(session.Id, 0);

        AppendPlaygroundEventsResult initial = await store.AppendAsync(session.Id, [first, Event(session.Id, 1)]);
        AppendPlaygroundEventsResult retried = await store.AppendAsync(session.Id, [first, first]);

        await Assert.That(initial.Accepted).IsEqualTo(2);
        await Assert.That(retried.Accepted).IsEqualTo(0);
        await Assert.That(retried.Duplicates).IsEqualTo(2);
        await Assert.That((await store.ReadAsync(session.Id)).Count).IsEqualTo(2);
    }

    [Test]
    [Arguments("memory")]
    [Arguments("turso")]
    public async Task Read_OrdersBySeqAcrossOutOfOrderBatches(string kind)
    {
        IPlaygroundEventStore store = Store(kind);
        PlaygroundSession session = await store.StartAsync(new StartPlaygroundSession("algebra-tiles"));

        await store.AppendAsync(session.Id, [Event(session.Id, 2), Event(session.Id, 3)]);
        await store.AppendAsync(session.Id, [Event(session.Id, 0), Event(session.Id, 1)]);

        await Assert.That((await store.ReadAsync(session.Id)).Select(record => record.Seq))
            .IsEquivalentTo(new long[] { 0, 1, 2, 3 });
        await Assert.That((await store.ReadAsync(session.Id, sinceSeq: 1)).Select(record => record.Seq))
            .IsEquivalentTo(new long[] { 2, 3 });
    }

    [Test]
    [Arguments("memory")]
    [Arguments("turso")]
    public async Task RoundTrip_KeepsEveryField(string kind)
    {
        IPlaygroundEventStore store = Store(kind);
        PlaygroundSession session = await store.StartAsync(new StartPlaygroundSession("algebra-tiles", Consent: "granted"));
        using JsonDocument data = JsonDocument.Parse("""{"term":"x","delta":{"x":1,"y":-2}}""");
        PlaygroundEventRecord original = new(
            Guid.NewGuid().ToString("D"), session.Id, "algebra-tiles", 7,
            DateTimeOffset.FromUnixTimeMilliseconds(1_763_600_000_123), "0123456789abcdef0123456789abcdef",
            "tile.moved", "rejected", "Keep tiles inside the board without overlapping.", data.RootElement.Clone(),
            new Dictionary<string, int> { ["x"] = 2, ["tiles"] = 3 }, DateTimeOffset.FromUnixTimeMilliseconds(1_763_600_001_000));

        await store.AppendAsync(session.Id, [original]);
        PlaygroundEventRecord stored = (await store.ReadAsync(session.Id)).Single();
        PlaygroundSession? found = await store.FindSessionAsync(session.Id);

        await Assert.That(found?.Consent).IsEqualTo("granted");
        await Assert.That(stored.At).IsEqualTo(original.At);
        await Assert.That(stored.TraceId).IsEqualTo(original.TraceId);
        await Assert.That(stored.Reason).IsEqualTo(original.Reason);
        await Assert.That(stored.Data.GetRawText()).IsEqualTo(original.Data.GetRawText());
        await Assert.That(stored.SceneSummary!["tiles"]).IsEqualTo(3);
    }

    [Test]
    [Arguments("memory")]
    [Arguments("turso")]
    public async Task Append_UnknownSessionIsRefused(string kind)
    {
        IPlaygroundEventStore store = Store(kind);
        string missing = Guid.NewGuid().ToString("N");

        AppendPlaygroundEventsResult result = await store.AppendAsync(missing, [Event(missing, 0)]);

        await Assert.That(result.Kind).IsEqualTo(AppendPlaygroundEventsResultKind.UnknownSession);
    }

    [Test]
    [Arguments("memory")]
    [Arguments("turso")]
    public async Task FindByAttempt_ReturnsLinkedSessions(string kind)
    {
        IPlaygroundEventStore store = Store(kind);
        string attempt = "attempt-" + Guid.NewGuid().ToString("N");
        PlaygroundSession linked = await store.StartAsync(new StartPlaygroundSession("base-ten", attempt));
        await store.StartAsync(new StartPlaygroundSession("base-ten", "attempt-other-" + Guid.NewGuid().ToString("N")));

        await Assert.That((await store.FindByAttemptAsync(attempt)).Select(session => session.Id))
            .IsEquivalentTo(new[] { linked.Id });
    }

    [Test]
    [Arguments("memory")]
    [Arguments("turso")]
    public async Task Delete_RemovesSessionAndEvents(string kind)
    {
        IPlaygroundEventStore store = Store(kind);
        PlaygroundSession session = await store.StartAsync(new StartPlaygroundSession("algebra-tiles"));
        await store.AppendAsync(session.Id, [Event(session.Id, 0)]);

        bool deleted = await store.DeleteSessionAsync(session.Id);
        bool again = await store.DeleteSessionAsync(session.Id);

        await Assert.That(deleted).IsTrue();
        await Assert.That(again).IsFalse();
        await Assert.That(await store.FindSessionAsync(session.Id)).IsNull();
        await Assert.That((await store.ReadAsync(session.Id)).Count).IsEqualTo(0);
    }

    [Test]
    [Arguments("memory")]
    [Arguments("turso")]
    public async Task Retention_DeletesOnlyExpiredSessions(string kind)
    {
        // Far-past clock so a shared Turso database keeps everyone else's rows.
        ManualTimeProvider time = new(new DateTimeOffset(2001, 1, 1, 0, 0, 0, TimeSpan.Zero));
        IPlaygroundEventStore store = Store(kind, time);
        PlaygroundSession old = await store.StartAsync(new StartPlaygroundSession("algebra-tiles"));
        await store.AppendAsync(old.Id, [Event(old.Id, 0)]);
        time.Advance(TimeSpan.FromDays(200));
        PlaygroundSession fresh = await store.StartAsync(new StartPlaygroundSession("algebra-tiles"));
        var retention = new PlaygroundEventRetentionService(
            store,
            Options.Create(new PlaygroundEventOptions { RetentionDays = 180 }),
            time,
            NullLogger<PlaygroundEventRetentionService>.Instance);

        int deleted = await retention.SweepAsync(CancellationToken.None);

        await Assert.That(deleted).IsGreaterThanOrEqualTo(1);
        await Assert.That(await store.FindSessionAsync(old.Id)).IsNull();
        await Assert.That((await store.ReadAsync(old.Id)).Count).IsEqualTo(0);
        await Assert.That(await store.FindSessionAsync(fresh.Id)).IsNotNull();
        await store.DeleteSessionAsync(fresh.Id);
    }

    [Test]
    [Arguments("memory")]
    [Arguments("turso")]
    public async Task ListSessions_PagesByStartTimeWithinRange(string kind)
    {
        ManualTimeProvider time = new(new DateTimeOffset(2002, 3, 1, 0, 0, 0, TimeSpan.Zero));
        IPlaygroundEventStore store = Store(kind, time);
        DateTimeOffset from = time.GetUtcNow();
        List<string> ids = [];
        for (int index = 0; index < 3; index++)
        {
            ids.Add((await store.StartAsync(new StartPlaygroundSession("bar-rod"))).Id);
            time.Advance(TimeSpan.FromMinutes(1));
        }

        List<string> listed = [];
        await foreach (PlaygroundSession session in store.ListSessionsAsync(from, from.AddMinutes(2)))
        {
            listed.Add(session.Id);
        }

        await Assert.That(listed).IsEquivalentTo(ids.Take(2));
        foreach (string id in ids) await store.DeleteSessionAsync(id);
    }

    [Test]
    public async Task Retention_ZeroDaysKeepsEverything()
    {
        InMemoryPlaygroundEventStore store = new(TimeProvider.System);
        await store.StartAsync(new StartPlaygroundSession("algebra-tiles"));
        var retention = new PlaygroundEventRetentionService(
            store,
            Options.Create(new PlaygroundEventOptions { RetentionDays = 0 }),
            new ManualTimeProvider(DateTimeOffset.UtcNow.AddYears(10)),
            NullLogger<PlaygroundEventRetentionService>.Instance);

        await Assert.That(await retention.SweepAsync(CancellationToken.None)).IsEqualTo(0);
    }
}

public sealed class LibSqlClientTests
{
    private sealed class Handler(string response, HttpStatusCode status = HttpStatusCode.OK) : HttpMessageHandler
    {
        public HttpRequestMessage? Request { get; private set; }
        public string? Body { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Request = request;
            Body = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(status) { Content = new StringContent(response, Encoding.UTF8, "application/json") };
        }
    }

    private static LibSqlClient Client(Handler handler, string url = "libsql://db-org.turso.io", string? token = "secret") =>
        new(new HttpClient(handler), Options.Create(new PlaygroundEventOptions { Turso = new() { Url = url, AuthToken = token } }));

    [Test]
    public async Task Execute_SendsPipelineWithTypedArgumentsAndToken()
    {
        Handler handler = new("""
            {"results":[{"type":"ok","response":{"type":"execute","result":{"cols":[{"name":"n"},{"name":"t"},{"name":"z"}],"rows":[[{"type":"integer","value":"9007199254740993"},{"type":"text","value":"a"},{"type":"null"}]],"affected_row_count":0}}},{"type":"ok","response":{"type":"close"}}]}
            """);

        IReadOnlyList<LibSqlResult> results = await Client(handler).ExecuteAsync([new("SELECT ?, ?, ?, ?", 5L, "a", null, true)]);

        await Assert.That(handler.Request!.RequestUri!.ToString()).IsEqualTo("https://db-org.turso.io/v2/pipeline");
        await Assert.That(handler.Request.Headers.Authorization!.ToString()).IsEqualTo("Bearer secret");
        await Assert.That(handler.Body!).Contains("\"type\":\"integer\",\"value\":\"5\"");
        await Assert.That(handler.Body!).Contains("\"type\":\"null\"");
        await Assert.That(handler.Body!).Contains("{\"type\":\"close\"}");
        await Assert.That(results[0].Rows[0][0]).IsEqualTo(9007199254740993L);
        await Assert.That(results[0].Rows[0][1]).IsEqualTo("a");
        await Assert.That(results[0].Rows[0][2]).IsNull();
    }

    [Test]
    public async Task Execute_RaisesStatementErrors()
    {
        Handler handler = new("""
            {"results":[{"type":"error","error":{"message":"no such table: missing","code":"SQLITE_UNKNOWN"}},{"type":"ok","response":{"type":"close"}}]}
            """);

        LibSqlException? error = null;
        try { await Client(handler, "http://127.0.0.1:8080", token: null).ExecuteAsync([new("SELECT * FROM missing")]); }
        catch (LibSqlException exception) { error = exception; }

        await Assert.That(error?.Code).IsEqualTo("SQLITE_UNKNOWN");
        await Assert.That(handler.Request!.Headers.Authorization).IsNull();
    }

    [Test]
    public async Task Execute_RaisesHttpFailures()
    {
        Handler handler = new("{}", HttpStatusCode.Unauthorized);

        LibSqlException? error = null;
        try { await Client(handler).ExecuteAsync([new("SELECT 1")]); }
        catch (LibSqlException exception) { error = exception; }

        await Assert.That(error?.Message).Contains("401");
    }
}

public sealed class PlaygroundEventSummaryTests
{
    private static readonly PlaygroundSession Session = new("session-1", "algebra-tiles", null, null, null, DateTimeOffset.UnixEpoch);

    [Test]
    public async Task Project_CountsTypesAndRejections()
    {
        PlaygroundEventRecord[] events =
        [
            PlaygroundEventStoreTests.Event(Session.Id, 0, "tile.added"),
            PlaygroundEventStoreTests.Event(Session.Id, 1, "tile.moved", "rejected", "Keep tiles inside the board without overlapping."),
            PlaygroundEventStoreTests.Event(Session.Id, 2, "tile.moved"),
        ];

        PlaygroundEventSummary summary = PlaygroundEventSummaryProjector.Project(Session, events);

        await Assert.That(summary.EventCount).IsEqualTo(3);
        await Assert.That(summary.AppliedCount).IsEqualTo(2);
        await Assert.That(summary.RejectedCount).IsEqualTo(1);
        await Assert.That(summary.CountsByType["tile.moved"]).IsEqualTo(2);
        await Assert.That(summary.Rejections.Single().Count).IsEqualTo(1);
        await Assert.That(summary.StuckSignals.Count).IsEqualTo(0);
    }

    [Test]
    public async Task Project_FlagsRepeatedRefusalUntilOvercome()
    {
        const string reason = "select-a-positive-and-a-negative-tile-of-the-same-term";
        List<PlaygroundEventRecord> events = Enumerable.Range(0, 3)
            .Select(seq => PlaygroundEventStoreTests.Event(Session.Id, seq, "zero-pair.cancelled", "rejected", reason))
            .ToList();

        PlaygroundEventSummary stuck = PlaygroundEventSummaryProjector.Project(Session, events);
        events.Add(PlaygroundEventStoreTests.Event(Session.Id, 3, "zero-pair.cancelled"));
        PlaygroundEventSummary recovered = PlaygroundEventSummaryProjector.Project(Session, events);

        await Assert.That(stuck.StuckSignals.Single().Repeats).IsEqualTo(3);
        await Assert.That(stuck.StuckSignals.Single().Reason).IsEqualTo(reason);
        await Assert.That(recovered.StuckSignals.Count).IsEqualTo(0);
    }

    [Test]
    public async Task Project_CapsIdleGapsInTimeOnTask()
    {
        PlaygroundEventRecord[] events =
        [
            PlaygroundEventStoreTests.Event(Session.Id, 0, at: DateTimeOffset.UnixEpoch),
            PlaygroundEventStoreTests.Event(Session.Id, 1, at: DateTimeOffset.UnixEpoch.AddSeconds(30)),
            PlaygroundEventStoreTests.Event(Session.Id, 2, at: DateTimeOffset.UnixEpoch.AddHours(2)),
        ];

        PlaygroundEventSummary summary = PlaygroundEventSummaryProjector.Project(Session, events);

        await Assert.That(summary.TimeOnTaskSeconds)
            .IsEqualTo(30 + PlaygroundEventSummaryProjector.IdleGap.TotalSeconds);
    }
}

public sealed class PlaygroundSessionEndpointTests : ApiTestBase
{
    private static async Task<string> StartSession(HttpClient client, string playground = "algebra-tiles")
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/playground-sessions", new { playground });
        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
        PlaygroundSessionResponse body = await response.Content.ReadFromJsonAsync<PlaygroundSessionResponse>()
            ?? throw new InvalidOperationException();
        return body.SessionId;
    }

    private static object EventBody(string sessionId, long seq, string? id = null, string type = "tile.added", string outcome = "applied", string? reason = null, object? data = null) => new
    {
        id = id ?? Guid.NewGuid().ToString("D"),
        sessionId,
        playground = "algebra-tiles",
        seq,
        at = DateTimeOffset.UnixEpoch.AddSeconds(seq).ToString("O"),
        type,
        outcome,
        reason,
        data = data ?? new { term = "x", sign = "positive" },
        sceneSummary = new Dictionary<string, int> { ["x"] = 1, ["tiles"] = 1 },
    };

    private static async Task<HttpStatusCode> AppendOne(HttpClient client, string sessionId, object body)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/playground-sessions/{sessionId}/events", new { sessionId, events = new[] { body } });
        return response.StatusCode;
    }

    [Test]
    public async Task Append_AcceptsEveryAllowlistedDataField()
    {
        using HttpClient client = Factory.CreateClient();
        string sessionId = await StartSession(client);
        object data = new
        {
            pieceIds = new[] { "algebra-tile-1" }, createdIds = new[] { "algebra-tile-2" }, pieceKinds = new[] { "x.neg" },
            delta = new { x = -1, y = 2 }, value = -3, values = new[] { 1, 2 }, count = 0, variant = "up", term = "x",
            sign = "negative", denomination = "tens", pose = "flat", orientation = "vertical", materialRole = "unit",
            shape = new { width = 2, depth = 3 }, satisfied = true, stepId = "step-1", length = 12,
        };

        await Assert.That(await AppendOne(client, sessionId, EventBody(sessionId, 0, data: data))).IsEqualTo(HttpStatusCode.OK);
    }

    [Test]
    [Arguments("""{ "note": "free text" }""")]
    [Arguments("""{ "term": "my name is Ana" }""")]
    [Arguments("""{ "pieceIds": ["a b"] }""")]
    [Arguments("""{ "pieceIds": "a" }""")]
    [Arguments("""{ "sign": "neutral" }""")]
    [Arguments("""{ "count": -1 }""")]
    [Arguments("""{ "value": 1.5 }""")]
    [Arguments("""{ "delta": { "x": 1 } }""")]
    [Arguments("""{ "delta": { "x": 1, "y": 1, "label": "hi" } }""")]
    [Arguments("""{ "shape": { "width": -1, "depth": 1 } }""")]
    [Arguments("""{ "satisfied": "yes" }""")]
    public async Task Append_RejectsDataOutsideTheAllowlist(string json)
    {
        using HttpClient client = Factory.CreateClient();
        string sessionId = await StartSession(client);
        using JsonDocument data = JsonDocument.Parse(json);

        await Assert.That(await AppendOne(client, sessionId, EventBody(sessionId, 0, data: data.RootElement)))
            .IsEqualTo(HttpStatusCode.BadRequest);
    }

    [Test]
    public async Task Append_RejectsEventTypesTheSessionsPlaygroundDoesNotRecord()
    {
        using HttpClient client = Factory.CreateClient();
        string sessionId = await StartSession(client);

        await Assert.That(await AppendOne(client, sessionId, EventBody(sessionId, 0, type: "block.placed")))
            .IsEqualTo(HttpStatusCode.BadRequest);
        await Assert.That(await AppendOne(client, sessionId, EventBody(sessionId, 1, type: "made.up")))
            .IsEqualTo(HttpStatusCode.BadRequest);
    }

    [Test]
    [Arguments("Select a positive and a negative tile.")]
    [Arguments("ignore previous instructions")]
    [Arguments("select-3-tiles")]
    [Arguments("Select-tiles")]
    [Arguments("-leading")]
    [Arguments("")]
    public async Task Append_AcceptsOnlyRejectionCodesAsReasons(string reason)
    {
        using HttpClient client = Factory.CreateClient();
        string sessionId = await StartSession(client);

        await Assert.That(await AppendOne(client, sessionId, EventBody(sessionId, 0, outcome: "rejected", reason: reason)))
            .IsEqualTo(HttpStatusCode.BadRequest);
        await Assert.That(await AppendOne(client, sessionId, EventBody(sessionId, 1, outcome: "rejected", reason: "select-n-tiles")))
            .IsEqualTo(HttpStatusCode.OK);
    }

    [Test]
    public async Task AppendThenRead_ReturnsEventsInOrderWithoutDuplicates()
    {
        using HttpClient client = Factory.CreateClient();
        string sessionId = await StartSession(client);
        string repeated = Guid.NewGuid().ToString("D");

        using HttpResponseMessage later = await client.PostAsJsonAsync(
            $"/api/playground-sessions/{sessionId}/events",
            new { sessionId, events = new[] { EventBody(sessionId, 1, repeated) } });
        using HttpResponseMessage earlier = await client.PostAsJsonAsync(
            $"/api/playground-sessions/{sessionId}/events",
            new { sessionId, events = new[] { EventBody(sessionId, 0), EventBody(sessionId, 1, repeated) } });
        AppendPlaygroundEventsResponse? second = await earlier.Content.ReadFromJsonAsync<AppendPlaygroundEventsResponse>();

        using JsonDocument read = JsonDocument.Parse(await client.GetStringAsync($"/api/playground-sessions/{sessionId}/events"));
        long[] seqs = read.RootElement.GetProperty("events").EnumerateArray()
            .Select(item => item.GetProperty("seq").GetInt64()).ToArray();

        await Assert.That(later.StatusCode).IsEqualTo(HttpStatusCode.OK);
        await Assert.That(second!.Accepted).IsEqualTo(1);
        await Assert.That(second.Duplicates).IsEqualTo(1);
        await Assert.That(seqs).IsEquivalentTo(new long[] { 0, 1 });
    }

    [Test]
    public async Task Summary_ReportsStuckSignals()
    {
        using HttpClient client = Factory.CreateClient();
        string sessionId = await StartSession(client);
        object[] events = Enumerable.Range(0, 3)
            .Select(seq => EventBody(sessionId, seq, type: "zero-pair.cancelled", outcome: "rejected", reason: "select-a-positive-and-a-negative-tile-of-the-same-term"))
            .ToArray();

        using HttpResponseMessage append = await client.PostAsJsonAsync($"/api/playground-sessions/{sessionId}/events", new { sessionId, events });
        using JsonDocument summary = JsonDocument.Parse(await client.GetStringAsync($"/api/playground-sessions/{sessionId}/summary"));

        await Assert.That(append.StatusCode).IsEqualTo(HttpStatusCode.OK);
        await Assert.That(summary.RootElement.GetProperty("rejectedCount").GetInt32()).IsEqualTo(3);
        await Assert.That(summary.RootElement.GetProperty("stuckSignals")[0].GetProperty("repeats").GetInt32()).IsEqualTo(3);
    }

    [Test]
    public async Task Append_RejectsEventsFromAnotherPlayground()
    {
        using HttpClient client = Factory.CreateClient();
        string sessionId = await StartSession(client, "base-ten");

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/playground-sessions/{sessionId}/events",
            new { sessionId, events = new[] { EventBody(sessionId, 0) } });

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    }

    [Test]
    public async Task Append_RejectsUnknownFields()
    {
        using HttpClient client = Factory.CreateClient();
        string sessionId = await StartSession(client);

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/playground-sessions/{sessionId}/events",
            new { sessionId, events = Array.Empty<object>(), learnerName = "x" });

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    }

    [Test]
    public async Task Append_UnknownSessionReturnsNotFound()
    {
        using HttpClient client = Factory.CreateClient();
        const string sessionId = "0123456789abcdef0123456789abcdef";

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/playground-sessions/{sessionId}/events",
            new { sessionId, events = new[] { EventBody(sessionId, 0) } });

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    }

    [Test]
    public async Task Start_RejectsUnknownPlaygroundAndMissingAttempt()
    {
        using HttpClient client = Factory.CreateClient();

        using HttpResponseMessage unknown = await client.PostAsJsonAsync("/api/playground-sessions", new { playground = "chess" });
        using HttpResponseMessage missing = await client.PostAsJsonAsync("/api/playground-sessions", new { playground = "base-ten", attemptId = "no-such-attempt" });

        await Assert.That(unknown.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
        await Assert.That(missing.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    }
}

public sealed class PlaygroundSessionLifecycleEndpointTests : ApiTestBase
{
    private static async Task<string> StartWithOneEvent(HttpClient client)
    {
        using HttpResponseMessage start = await client.PostAsJsonAsync(
            "/api/playground-sessions", new { playground = "base-ten", consent = "granted" });
        string sessionId = (await start.Content.ReadFromJsonAsync<PlaygroundSessionResponse>())!.SessionId;
        using HttpResponseMessage append = await client.PostAsJsonAsync($"/api/playground-sessions/{sessionId}/events", new
        {
            sessionId,
            events = new[]
            {
                new
                {
                    id = Guid.NewGuid().ToString("D"), sessionId, playground = "base-ten", seq = 0,
                    at = DateTimeOffset.UtcNow.ToString("O"), type = "block.placed", outcome = "applied",
                    data = new { denomination = "tens" },
                },
            },
        });
        await Assert.That(append.StatusCode).IsEqualTo(HttpStatusCode.OK);
        return sessionId;
    }

    [Test]
    public async Task ExportOne_ReturnsSessionConsentAndEvents()
    {
        using HttpClient client = Factory.CreateClient();
        string sessionId = await StartWithOneEvent(client);

        using JsonDocument export = JsonDocument.Parse(await client.GetStringAsync($"/api/playground-sessions/{sessionId}/export"));

        await Assert.That(export.RootElement.GetProperty("session").GetProperty("consent").GetString()).IsEqualTo("granted");
        await Assert.That(export.RootElement.GetProperty("events").GetArrayLength()).IsEqualTo(1);
    }

    [Test]
    public async Task ExportAll_StreamsOneLinePerSessionInRange()
    {
        using HttpClient client = Factory.CreateClient();
        DateTimeOffset from = DateTimeOffset.UtcNow.AddSeconds(-1);
        string sessionId = await StartWithOneEvent(client);

        using HttpResponseMessage response = await client.GetAsync(
            $"/api/playground-sessions/export?from={Uri.EscapeDataString(from.ToString("O"))}");
        string[] lines = (await response.Content.ReadAsStringAsync()).Split('\n', StringSplitOptions.RemoveEmptyEntries);

        await Assert.That(response.Content.Headers.ContentType?.MediaType).IsEqualTo("application/x-ndjson");
        await Assert.That(lines.Select(line => JsonDocument.Parse(line).RootElement.GetProperty("session").GetProperty("id").GetString()))
            .Contains(sessionId);
    }

    [Test]
    public async Task Delete_RemovesTheSession()
    {
        using HttpClient client = Factory.CreateClient();
        string sessionId = await StartWithOneEvent(client);

        using HttpResponseMessage deleted = await client.DeleteAsync($"/api/playground-sessions/{sessionId}");
        using HttpResponseMessage again = await client.DeleteAsync($"/api/playground-sessions/{sessionId}");
        using HttpResponseMessage read = await client.GetAsync($"/api/playground-sessions/{sessionId}/events");

        await Assert.That(deleted.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
        await Assert.That(again.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
        await Assert.That(read.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    }

    [Test]
    public async Task Start_RejectsUnknownConsentValues()
    {
        using HttpClient client = Factory.CreateClient();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/playground-sessions", new { playground = "base-ten", consent = "maybe" });

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    }
}

public sealed class LimitedStartsApiFactory : TUnit.AspNetCore.TestWebApplicationFactory<Program>
{
    protected override void ConfigureStartupConfiguration(Microsoft.Extensions.Configuration.IConfigurationBuilder configuration)
    {
        Microsoft.Extensions.Configuration.MemoryConfigurationBuilderExtensions.AddInMemoryCollection(configuration, new Dictionary<string, string?>
        {
            ["AI:Enabled"] = "false",
            ["PlaygroundEvents:SessionStartsPerMinute"] = "2",
        });
    }
}

public sealed class PlaygroundSessionStartLimitTests : TUnit.AspNetCore.WebApplicationTest<LimitedStartsApiFactory, Program>
{
    [Test]
    public async Task Start_ReturnsTooManyRequestsOnceTheBudgetIsSpent()
    {
        using HttpClient client = Factory.CreateClient();
        HttpStatusCode[] statuses = new HttpStatusCode[3];
        for (int i = 0; i < statuses.Length; i++)
        {
            using HttpResponseMessage response = await client.PostAsJsonAsync("/api/playground-sessions", new { playground = "base-ten" });
            statuses[i] = response.StatusCode;
        }

        await Assert.That(statuses).IsEquivalentTo(new[] { HttpStatusCode.Created, HttpStatusCode.Created, HttpStatusCode.TooManyRequests });
    }
}
