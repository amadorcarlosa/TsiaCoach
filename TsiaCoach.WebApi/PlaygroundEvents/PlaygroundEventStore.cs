using System.Runtime.CompilerServices;
using System.Text.Json;

namespace TsiaCoach.WebApi.PlaygroundEvents;

/// <summary>A learner's run of one playground, optionally tied to state the API already owns.</summary>
/// <param name="Consent">"granted" when the learner opted in; null when the deployment does not ask.</param>
public sealed record PlaygroundSession(
    string Id,
    string Playground,
    string? AttemptId,
    string? ScaffoldSessionId,
    string? LevelId,
    DateTimeOffset StartedAt,
    string? Consent = null);

/// <summary>One committed or refused learner action. <see cref="Data"/> is an allowlisted JSON object.</summary>
public sealed record PlaygroundEventRecord(
    string Id,
    string SessionId,
    string Playground,
    long Seq,
    DateTimeOffset At,
    string? TraceId,
    string Type,
    string Outcome,
    string? Reason,
    JsonElement Data,
    IReadOnlyDictionary<string, int>? SceneSummary,
    DateTimeOffset ReceivedAt);

public enum AppendPlaygroundEventsResultKind
{
    Appended,
    UnknownSession,
    SessionFull
}

public sealed record AppendPlaygroundEventsResult(
    AppendPlaygroundEventsResultKind Kind,
    int Accepted = 0,
    int Duplicates = 0);

public sealed record StartPlaygroundSession(
    string Playground,
    string? AttemptId = null,
    string? ScaffoldSessionId = null,
    string? LevelId = null,
    string? Consent = null);

/// <summary>Append-only event storage: Turso in deployments, in memory for tests and quick local runs.</summary>
public interface IPlaygroundEventStore
{
    Task<PlaygroundSession> StartAsync(StartPlaygroundSession request, CancellationToken cancellationToken = default);

    Task<PlaygroundSession?> FindSessionAsync(string sessionId, CancellationToken cancellationToken = default);

    /// <summary>Appends new events. An event whose ID is already stored for the session is a duplicate and is ignored.</summary>
    Task<AppendPlaygroundEventsResult> AppendAsync(
        string sessionId,
        IReadOnlyList<PlaygroundEventRecord> events,
        CancellationToken cancellationToken = default);

    /// <summary>Events ordered by sequence, then time, then ID; only those after <paramref name="sinceSeq"/> when given.</summary>
    Task<IReadOnlyList<PlaygroundEventRecord>> ReadAsync(
        string sessionId,
        long? sinceSeq = null,
        int limit = PlaygroundEventLimits.MaxEventsPerSession,
        CancellationToken cancellationToken = default);

    /// <summary>Sessions linked to an attempt, newest first.</summary>
    Task<IReadOnlyList<PlaygroundSession>> FindByAttemptAsync(string attemptId, CancellationToken cancellationToken = default);

    /// <summary>Deletes a session and its events. False when there was no such session.</summary>
    Task<bool> DeleteSessionAsync(string sessionId, CancellationToken cancellationToken = default);

    /// <summary>Retention: deletes every session started before <paramref name="cutoff"/>, with its events. Returns the session count.</summary>
    Task<int> DeleteStartedBeforeAsync(DateTimeOffset cutoff, CancellationToken cancellationToken = default);

    /// <summary>Sessions started in [<paramref name="from"/>, <paramref name="to"/>), oldest first, for export.</summary>
    IAsyncEnumerable<PlaygroundSession> ListSessionsAsync(
        DateTimeOffset? from,
        DateTimeOffset? to,
        CancellationToken cancellationToken = default);
}

public static class PlaygroundEventLimits
{
    public const int MaxEventsPerSession = 5_000;
    public const int MaxSessionsPerAttempt = 50;
}

public sealed class InMemoryPlaygroundEventStore : IPlaygroundEventStore
{
    public const int MaxSessions = 10_000;

    internal static readonly Comparison<PlaygroundEventRecord> Order = (left, right) =>
    {
        int bySeq = left.Seq.CompareTo(right.Seq);
        if (bySeq != 0) return bySeq;
        int byTime = left.At.CompareTo(right.At);
        return byTime != 0 ? byTime : string.CompareOrdinal(left.Id, right.Id);
    };

    private readonly object sync = new();
    // Insertion order doubles as age, so the oldest session is evicted first.
    private readonly Dictionary<string, SessionState> sessions = new(StringComparer.Ordinal);
    private readonly LinkedList<string> age = new();
    private readonly TimeProvider timeProvider;

    public InMemoryPlaygroundEventStore(TimeProvider timeProvider)
    {
        this.timeProvider = timeProvider;
    }

    public Task<PlaygroundSession> StartAsync(StartPlaygroundSession request, CancellationToken cancellationToken = default)
    {
        lock (sync)
        {
            string id;
            do
            {
                id = Guid.NewGuid().ToString("N");
            }
            while (sessions.ContainsKey(id));

            if (sessions.Count >= MaxSessions && age.First is { } oldest)
            {
                sessions.Remove(oldest.Value);
                age.RemoveFirst();
            }

            PlaygroundSession session = new(
                id,
                request.Playground,
                request.AttemptId,
                request.ScaffoldSessionId,
                request.LevelId,
                timeProvider.GetUtcNow(),
                request.Consent);
            sessions.Add(id, new SessionState(session));
            age.AddLast(id);
            return Task.FromResult(session);
        }
    }

    public Task<PlaygroundSession?> FindSessionAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        lock (sync)
        {
            return Task.FromResult(sessions.TryGetValue(sessionId, out SessionState? state) ? state.Session : null);
        }
    }

    public Task<AppendPlaygroundEventsResult> AppendAsync(
        string sessionId,
        IReadOnlyList<PlaygroundEventRecord> events,
        CancellationToken cancellationToken = default)
    {
        lock (sync)
        {
            if (!sessions.TryGetValue(sessionId, out SessionState? state))
            {
                return Task.FromResult(new AppendPlaygroundEventsResult(AppendPlaygroundEventsResultKind.UnknownSession));
            }

            List<PlaygroundEventRecord> fresh = [];
            HashSet<string> batchIds = new(StringComparer.Ordinal);
            int duplicates = 0;
            foreach (PlaygroundEventRecord record in events)
            {
                if (state.Ids.Contains(record.Id) || !batchIds.Add(record.Id))
                {
                    duplicates++;
                    continue;
                }

                fresh.Add(record);
            }

            if (state.Events.Count + fresh.Count > PlaygroundEventLimits.MaxEventsPerSession)
            {
                return Task.FromResult(new AppendPlaygroundEventsResult(AppendPlaygroundEventsResultKind.SessionFull, 0, duplicates));
            }

            foreach (PlaygroundEventRecord record in fresh)
            {
                state.Ids.Add(record.Id);
                state.Events.Add(record);
            }

            // Batches can arrive out of order after a retry; reads stay ordered by seq.
            if (fresh.Count > 0)
            {
                state.Events.Sort(Order);
            }

            return Task.FromResult(new AppendPlaygroundEventsResult(AppendPlaygroundEventsResultKind.Appended, fresh.Count, duplicates));
        }
    }

    public Task<IReadOnlyList<PlaygroundEventRecord>> ReadAsync(
        string sessionId,
        long? sinceSeq = null,
        int limit = PlaygroundEventLimits.MaxEventsPerSession,
        CancellationToken cancellationToken = default)
    {
        lock (sync)
        {
            IReadOnlyList<PlaygroundEventRecord> events = sessions.TryGetValue(sessionId, out SessionState? state)
                ? state.Events
                    .Where(record => sinceSeq is null || record.Seq > sinceSeq)
                    .Take(Math.Max(0, limit))
                    .ToArray()
                : [];
            return Task.FromResult(events);
        }
    }

    public Task<IReadOnlyList<PlaygroundSession>> FindByAttemptAsync(string attemptId, CancellationToken cancellationToken = default)
    {
        lock (sync)
        {
            IReadOnlyList<PlaygroundSession> found = sessions.Values
                .Select(state => state.Session)
                .Where(session => string.Equals(session.AttemptId, attemptId, StringComparison.Ordinal))
                .OrderByDescending(session => session.StartedAt)
                .Take(PlaygroundEventLimits.MaxSessionsPerAttempt)
                .ToArray();
            return Task.FromResult(found);
        }
    }

    public Task<bool> DeleteSessionAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        lock (sync)
        {
            bool removed = sessions.Remove(sessionId);
            if (removed) age.Remove(sessionId);
            return Task.FromResult(removed);
        }
    }

    public Task<int> DeleteStartedBeforeAsync(DateTimeOffset cutoff, CancellationToken cancellationToken = default)
    {
        lock (sync)
        {
            string[] expired = sessions.Values
                .Where(state => state.Session.StartedAt < cutoff)
                .Select(state => state.Session.Id)
                .ToArray();
            foreach (string id in expired)
            {
                sessions.Remove(id);
                age.Remove(id);
            }

            return Task.FromResult(expired.Length);
        }
    }

    public async IAsyncEnumerable<PlaygroundSession> ListSessionsAsync(
        DateTimeOffset? from,
        DateTimeOffset? to,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        PlaygroundSession[] snapshot;
        lock (sync)
        {
            snapshot = sessions.Values
                .Select(state => state.Session)
                .Where(session => (from is null || session.StartedAt >= from) && (to is null || session.StartedAt < to))
                .OrderBy(session => session.StartedAt)
                .ThenBy(session => session.Id, StringComparer.Ordinal)
                .ToArray();
        }

        foreach (PlaygroundSession session in snapshot)
        {
            cancellationToken.ThrowIfCancellationRequested();
            yield return session;
        }

        await Task.CompletedTask;
    }

    private sealed class SessionState(PlaygroundSession session)
    {
        public PlaygroundSession Session { get; } = session;
        public HashSet<string> Ids { get; } = new(StringComparer.Ordinal);
        public List<PlaygroundEventRecord> Events { get; } = [];
    }
}
