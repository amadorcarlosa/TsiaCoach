namespace TsiaCoach.WebApi.PlaygroundEvents;

/// <summary>
/// What the coach sees of a student's playground work: counts, outcomes,
/// authored refusal reasons and scene totals. Event data (piece, step and
/// scaffold IDs) is left out, so the model cannot learn routes it may not name.
/// </summary>
public sealed record PlaygroundActivityContext(
    IReadOnlyList<PlaygroundSessionActivity> Sessions);

public sealed record PlaygroundSessionActivity(
    string Playground,
    int EventCount,
    int AppliedCount,
    int RejectedCount,
    double TimeOnTaskSeconds,
    IReadOnlyDictionary<string, int> CountsByType,
    IReadOnlyList<PlaygroundRejectionSummary> TopRejections,
    IReadOnlyList<PlaygroundStuckSignal> StuckSignals,
    IReadOnlyList<PlaygroundRecentAction> RecentActions,
    IReadOnlyDictionary<string, int>? LatestSceneSummary);

public sealed record PlaygroundRecentAction(string Type, string Outcome, string? Reason);

public static class PlaygroundActivityProjector
{
    public const int MaxSessions = 3;
    public const int MaxRejections = 3;
    public const int MaxRecentActions = 5;

    /// <summary>The newest sessions linked to the attempt that have events, or null when there are none.</summary>
    public static async Task<PlaygroundActivityContext?> ForAttemptAsync(
        IPlaygroundEventStore store,
        string attemptId,
        CancellationToken cancellationToken = default)
    {
        List<PlaygroundSessionActivity> sessions = [];
        foreach (PlaygroundSession session in await store.FindByAttemptAsync(attemptId, cancellationToken))
        {
            if (sessions.Count == MaxSessions) break;
            IReadOnlyList<PlaygroundEventRecord> events = await store.ReadAsync(session.Id, cancellationToken: cancellationToken);
            if (events.Count == 0) continue;
            PlaygroundEventSummary summary = PlaygroundEventSummaryProjector.Project(session, events);
            sessions.Add(new PlaygroundSessionActivity(
                summary.Playground,
                summary.EventCount,
                summary.AppliedCount,
                summary.RejectedCount,
                Math.Round(summary.TimeOnTaskSeconds, 1),
                summary.CountsByType,
                summary.Rejections.Take(MaxRejections).ToArray(),
                summary.StuckSignals,
                summary.Recent
                    .Skip(Math.Max(0, summary.Recent.Count - MaxRecentActions))
                    .Select(record => new PlaygroundRecentAction(record.Type, record.Outcome, record.Reason))
                    .ToArray(),
                summary.LatestSceneSummary));
        }

        return sessions.Count == 0 ? null : new PlaygroundActivityContext(sessions);
    }
}
