using System.Runtime.CompilerServices;
using System.Text.Json;
using Turso.Serverless.Client;

namespace TsiaCoach.WebApi.PlaygroundEvents;

/// <summary>
/// Playground sessions and events stored in Turso. Times are stored as Unix milliseconds.
/// </summary>
public sealed class TursoPlaygroundEventStore(TursoConnectionFactory connections, TimeProvider timeProvider) : IPlaygroundEventStore
{
    private const string SessionColumns = "id, playground, attempt_id, scaffold_session_id, level_id, started_at, consent";
    private const string EventColumns =
        "id, session_id, playground, seq, at, trace_id, type, outcome, reason, data, scene_summary, received_at";
    private const int EventsPerInsert = 100;

    private static readonly TursoBatchStatement[] Schema =
    [
        new("""
            CREATE TABLE IF NOT EXISTS playground_sessions (
              id TEXT PRIMARY KEY,
              playground TEXT NOT NULL,
              attempt_id TEXT,
              scaffold_session_id TEXT,
              level_id TEXT,
              started_at INTEGER NOT NULL,
              consent TEXT
            )
            """),
        new("CREATE INDEX IF NOT EXISTS ix_playground_sessions_attempt ON playground_sessions (attempt_id, started_at)"),
        new("CREATE INDEX IF NOT EXISTS ix_playground_sessions_started ON playground_sessions (started_at, id)"),
        new("""
            CREATE TABLE IF NOT EXISTS playground_events (
              session_id TEXT NOT NULL,
              id TEXT NOT NULL,
              playground TEXT NOT NULL,
              seq INTEGER NOT NULL,
              at INTEGER NOT NULL,
              trace_id TEXT,
              type TEXT NOT NULL,
              outcome TEXT NOT NULL,
              reason TEXT,
              data TEXT NOT NULL,
              scene_summary TEXT,
              received_at INTEGER NOT NULL,
              PRIMARY KEY (session_id, id)
            )
            """),
        new("CREATE INDEX IF NOT EXISTS ix_playground_events_order ON playground_events (session_id, seq, at, id)"),
    ];

    private readonly SemaphoreSlim schemaLock = new(1, 1);
    private volatile bool schemaReady;

    private async Task<TursoResultSet> ExecuteAsync(string sql, IReadOnlyList<object?> args, CancellationToken cancellationToken)
    {
        await using var connection = connections.CreateConnection();
        await EnsureSchemaAsync(connection, cancellationToken);
        return await connection.ExecuteAsync(sql, args, cancellationToken: cancellationToken);
    }

    private async Task EnsureSchemaAsync(TursoServerlessConnection connection, CancellationToken cancellationToken)
    {
        if (schemaReady) return;
        await schemaLock.WaitAsync(cancellationToken);
        try
        {
            if (schemaReady) return;
            await connection.BatchAsync(Schema, TursoBatchMode.Immediate, cancellationToken: cancellationToken);
            schemaReady = true;
        }
        finally
        {
            schemaLock.Release();
        }
    }

    public async Task<PlaygroundSession> StartAsync(StartPlaygroundSession request, CancellationToken cancellationToken = default)
    {
        PlaygroundSession session = new(
            Guid.NewGuid().ToString("N"),
            request.Playground,
            request.AttemptId,
            request.ScaffoldSessionId,
            request.LevelId,
            FromMillis(ToMillis(timeProvider.GetUtcNow())),
            request.Consent);
        await ExecuteAsync(
            $"INSERT INTO playground_sessions ({SessionColumns}) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [session.Id, session.Playground, session.AttemptId, session.ScaffoldSessionId, session.LevelId,
             ToMillis(session.StartedAt), session.Consent], cancellationToken);
        return session;
    }

    public async Task<PlaygroundSession?> FindSessionAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        var result = await ExecuteAsync(
            $"SELECT {SessionColumns} FROM playground_sessions WHERE id = ?", [sessionId], cancellationToken);
        return result.Rows.Select(ToSession).FirstOrDefault();
    }

    public async Task<AppendPlaygroundEventsResult> AppendAsync(
        string sessionId,
        IReadOnlyList<PlaygroundEventRecord> events,
        CancellationToken cancellationToken = default)
    {
        await using var connection = connections.CreateConnection();
        await EnsureSchemaAsync(connection, cancellationToken);
        // Reserve the write before checking the cap so two appends cannot claim the same remaining slots.
        await using var transaction = await connection.BeginTransactionAsync(TursoBatchMode.Immediate, cancellationToken);
        var state = await transaction.ExecuteAsync("""
            SELECT (SELECT COUNT(*) FROM playground_events WHERE session_id = ?)
            FROM playground_sessions WHERE id = ?
            """, [sessionId, sessionId], cancellationToken);
        if (state.Rows.Count == 0)
        {
            return new(AppendPlaygroundEventsResultKind.UnknownSession);
        }

        int accepted = 0;
        foreach (var batch in events.Chunk(EventsPerInsert))
        {
            string values = string.Join(", ", Enumerable.Repeat("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", batch.Length));
            List<object?> args = new(batch.Length * 12);
            foreach (PlaygroundEventRecord record in batch)
            {
                args.AddRange([
                    record.Id, sessionId, record.Playground, record.Seq, ToMillis(record.At), record.TraceId,
                    record.Type, record.Outcome, record.Reason, record.Data.GetRawText(),
                    record.SceneSummary is null ? null : JsonSerializer.Serialize(record.SceneSummary),
                    ToMillis(record.ReceivedAt),
                ]);
            }
            var inserted = await transaction.ExecuteAsync(
                $"INSERT INTO playground_events ({EventColumns}) VALUES {values} ON CONFLICT(session_id, id) DO NOTHING",
                args, cancellationToken);
            accepted += checked((int)inserted.RowsAffected);
        }

        int duplicates = events.Count - accepted;
        if (accepted > 0 && state.Rows[0].GetInt64(0) + accepted > PlaygroundEventLimits.MaxEventsPerSession)
        {
            await transaction.RollbackAsync(cancellationToken);
            return new(AppendPlaygroundEventsResultKind.SessionFull, 0, duplicates);
        }

        await transaction.CommitAsync(cancellationToken);
        return new(AppendPlaygroundEventsResultKind.Appended, accepted, duplicates);
    }

    public async Task<IReadOnlyList<PlaygroundEventRecord>> ReadAsync(
        string sessionId,
        long? sinceSeq = null,
        int limit = PlaygroundEventLimits.MaxEventsPerSession,
        CancellationToken cancellationToken = default)
    {
        var result = await ExecuteAsync(
            $"SELECT {EventColumns} FROM playground_events WHERE session_id = ? AND (? IS NULL OR seq > ?) ORDER BY seq, at, id LIMIT ?",
            [sessionId, sinceSeq, sinceSeq, Math.Max(0, limit)], cancellationToken);
        return result.Rows.Select(ToEvent).ToArray();
    }

    public async Task<IReadOnlyList<PlaygroundSession>> FindByAttemptAsync(string attemptId, CancellationToken cancellationToken = default)
    {
        var result = await ExecuteAsync(
            $"SELECT {SessionColumns} FROM playground_sessions WHERE attempt_id = ? ORDER BY started_at DESC, id LIMIT ?",
            [attemptId, PlaygroundEventLimits.MaxSessionsPerAttempt], cancellationToken);
        return result.Rows.Select(ToSession).ToArray();
    }

    public async Task<bool> DeleteSessionAsync(string sessionId, CancellationToken cancellationToken = default) =>
        await DeleteSessionsAsync("id = ?", sessionId, cancellationToken) > 0;

    public Task<int> DeleteStartedBeforeAsync(DateTimeOffset cutoff, CancellationToken cancellationToken = default) =>
        DeleteSessionsAsync("started_at < ?", ToMillis(cutoff), cancellationToken);

    private async Task<int> DeleteSessionsAsync(string predicate, object value, CancellationToken cancellationToken)
    {
        await using var connection = connections.CreateConnection();
        await EnsureSchemaAsync(connection, cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(TursoBatchMode.Immediate, cancellationToken);
        await transaction.ExecuteAsync(
            $"DELETE FROM playground_events WHERE session_id IN (SELECT id FROM playground_sessions WHERE {predicate})",
            [value], cancellationToken);
        var deleted = await transaction.ExecuteAsync(
            $"DELETE FROM playground_sessions WHERE {predicate}", [value], cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return checked((int)deleted.RowsAffected);
    }

    public async IAsyncEnumerable<PlaygroundSession> ListSessionsAsync(
        DateTimeOffset? from,
        DateTimeOffset? to,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        const int page = 500;
        long after = from is null ? long.MinValue : ToMillis(from.Value) - 1;
        string afterId = "￿";
        long before = to is null ? long.MaxValue : ToMillis(to.Value);
        while (true)
        {
            // Keyset paging on (started_at, id) so concurrent inserts never shift a page.
            var result = await ExecuteAsync(
                $"SELECT {SessionColumns} FROM playground_sessions WHERE (started_at > ? OR (started_at = ? AND id > ?)) AND started_at < ? ORDER BY started_at, id LIMIT ?",
                [after, after, afterId, before, page], cancellationToken);
            foreach (var row in result.Rows)
            {
                PlaygroundSession session = ToSession(row);
                after = ToMillis(session.StartedAt);
                afterId = session.Id;
                yield return session;
            }

            if (result.Rows.Count < page) yield break;
        }
    }

    private static long ToMillis(DateTimeOffset value) => value.ToUnixTimeMilliseconds();

    private static DateTimeOffset FromMillis(long value) => DateTimeOffset.FromUnixTimeMilliseconds(value);

    private static PlaygroundSession ToSession(IReadOnlyList<object?> row) => new(
        (string)row[0]!,
        (string)row[1]!,
        (string?)row[2],
        (string?)row[3],
        (string?)row[4],
        FromMillis((long)row[5]!),
        (string?)row[6]);

    private static PlaygroundEventRecord ToEvent(IReadOnlyList<object?> row)
    {
        using JsonDocument data = JsonDocument.Parse((string)row[9]!);
        return new PlaygroundEventRecord(
            (string)row[0]!,
            (string)row[1]!,
            (string)row[2]!,
            (long)row[3]!,
            FromMillis((long)row[4]!),
            (string?)row[5],
            (string)row[6]!,
            (string)row[7]!,
            (string?)row[8],
            data.RootElement.Clone(),
            row[10] is string summary ? JsonSerializer.Deserialize<Dictionary<string, int>>(summary) : null,
            FromMillis((long)row[11]!));
    }
}
