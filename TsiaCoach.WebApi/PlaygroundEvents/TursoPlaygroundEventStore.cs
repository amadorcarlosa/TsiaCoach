using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;

namespace TsiaCoach.WebApi.PlaygroundEvents;

/// <summary>
/// Playground sessions and events in Turso (libSQL). Times are stored as Unix
/// milliseconds. Every write is idempotent, so the HTTP client's retries are safe.
/// </summary>
public sealed class TursoPlaygroundEventStore(LibSqlClient client, TimeProvider timeProvider) : IPlaygroundEventStore
{
    private const string SessionColumns = "id, playground, attempt_id, scaffold_session_id, level_id, started_at, consent";
    private const string EventColumns =
        "id, session_id, playground, seq, at, trace_id, type, outcome, reason, data, scene_summary, received_at";

    private static readonly LibSqlStatement[] Schema =
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

    private async Task<IReadOnlyList<LibSqlResult>> Execute(CancellationToken cancellationToken, params LibSqlStatement[] statements)
    {
        await EnsureSchema(cancellationToken);
        return await client.ExecuteAsync(statements, cancellationToken);
    }

    private async Task EnsureSchema(CancellationToken cancellationToken)
    {
        if (schemaReady) return;
        await schemaLock.WaitAsync(cancellationToken);
        try
        {
            if (schemaReady) return;
            await client.ExecuteAsync(Schema, cancellationToken);
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
        await Execute(cancellationToken, new LibSqlStatement(
            $"INSERT OR IGNORE INTO playground_sessions ({SessionColumns}) VALUES (?, ?, ?, ?, ?, ?, ?)",
            session.Id, session.Playground, session.AttemptId, session.ScaffoldSessionId, session.LevelId,
            ToMillis(session.StartedAt), session.Consent));
        return session;
    }

    public async Task<PlaygroundSession?> FindSessionAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<LibSqlResult> results = await Execute(cancellationToken, new LibSqlStatement(
            $"SELECT {SessionColumns} FROM playground_sessions WHERE id = ?", sessionId));
        return results[0].Rows.Select(ToSession).FirstOrDefault();
    }

    public async Task<AppendPlaygroundEventsResult> AppendAsync(
        string sessionId,
        IReadOnlyList<PlaygroundEventRecord> events,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyList<LibSqlResult> state = await Execute(cancellationToken,
            new LibSqlStatement("SELECT 1 FROM playground_sessions WHERE id = ?", sessionId),
            new LibSqlStatement("SELECT COUNT(*) FROM playground_events WHERE session_id = ?", sessionId));
        if (state[0].Rows.Count == 0)
        {
            return new(AppendPlaygroundEventsResultKind.UnknownSession);
        }

        // Repeats inside one batch are duplicates too; the database ignores repeats across batches.
        PlaygroundEventRecord[] distinct = events.DistinctBy(record => record.Id, StringComparer.Ordinal).ToArray();
        int repeatedInBatch = events.Count - distinct.Length;
        long stored = (long)state[1].Rows[0][0]!;
        if (distinct.Length == 0)
        {
            return new(AppendPlaygroundEventsResultKind.Appended, 0, repeatedInBatch);
        }

        if (stored + distinct.Length > PlaygroundEventLimits.MaxEventsPerSession)
        {
            return new(AppendPlaygroundEventsResultKind.SessionFull, 0, repeatedInBatch);
        }

        // One statement, so a batch lands entirely or not at all.
        StringBuilder sql = new($"INSERT OR IGNORE INTO playground_events ({EventColumns}) VALUES ");
        List<object?> args = new(distinct.Length * 12);
        for (int index = 0; index < distinct.Length; index++)
        {
            PlaygroundEventRecord record = distinct[index];
            sql.Append(index == 0 ? "" : ", ").Append("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            args.AddRange([
                record.Id, sessionId, record.Playground, record.Seq, ToMillis(record.At), record.TraceId,
                record.Type, record.Outcome, record.Reason, record.Data.GetRawText(),
                record.SceneSummary is null ? null : JsonSerializer.Serialize(record.SceneSummary),
                ToMillis(record.ReceivedAt),
            ]);
        }

        LibSqlResult inserted = (await Execute(cancellationToken, new LibSqlStatement(sql.ToString(), [.. args])))[0];
        int accepted = (int)inserted.AffectedRows;
        return new(AppendPlaygroundEventsResultKind.Appended, accepted, events.Count - accepted);
    }

    public async Task<IReadOnlyList<PlaygroundEventRecord>> ReadAsync(
        string sessionId,
        long? sinceSeq = null,
        int limit = PlaygroundEventLimits.MaxEventsPerSession,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyList<LibSqlResult> results = await Execute(cancellationToken, new LibSqlStatement(
            $"SELECT {EventColumns} FROM playground_events WHERE session_id = ? AND (? IS NULL OR seq > ?) ORDER BY seq, at, id LIMIT ?",
            sessionId, sinceSeq, sinceSeq, (long)Math.Max(0, limit)));
        return results[0].Rows.Select(ToEvent).ToArray();
    }

    public async Task<IReadOnlyList<PlaygroundSession>> FindByAttemptAsync(string attemptId, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<LibSqlResult> results = await Execute(cancellationToken, new LibSqlStatement(
            $"SELECT {SessionColumns} FROM playground_sessions WHERE attempt_id = ? ORDER BY started_at DESC, id LIMIT ?",
            attemptId, (long)PlaygroundEventLimits.MaxSessionsPerAttempt));
        return results[0].Rows.Select(ToSession).ToArray();
    }

    public async Task<bool> DeleteSessionAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<LibSqlResult> results = await Execute(cancellationToken,
            new LibSqlStatement("DELETE FROM playground_events WHERE session_id = ?", sessionId),
            new LibSqlStatement("DELETE FROM playground_sessions WHERE id = ?", sessionId));
        return results[1].AffectedRows > 0;
    }

    public async Task<int> DeleteStartedBeforeAsync(DateTimeOffset cutoff, CancellationToken cancellationToken = default)
    {
        long millis = ToMillis(cutoff);
        IReadOnlyList<LibSqlResult> results = await Execute(cancellationToken,
            new LibSqlStatement(
                "DELETE FROM playground_events WHERE session_id IN (SELECT id FROM playground_sessions WHERE started_at < ?)",
                millis),
            new LibSqlStatement("DELETE FROM playground_sessions WHERE started_at < ?", millis));
        return (int)results[1].AffectedRows;
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
            IReadOnlyList<LibSqlResult> results = await Execute(cancellationToken, new LibSqlStatement(
                $"SELECT {SessionColumns} FROM playground_sessions WHERE (started_at > ? OR (started_at = ? AND id > ?)) AND started_at < ? ORDER BY started_at, id LIMIT ?",
                after, after, afterId, before, (long)page));
            IReadOnlyList<IReadOnlyList<object?>> rows = results[0].Rows;
            foreach (IReadOnlyList<object?> row in rows)
            {
                PlaygroundSession session = ToSession(row);
                after = ToMillis(session.StartedAt);
                afterId = session.Id;
                yield return session;
            }

            if (rows.Count < page) yield break;
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
