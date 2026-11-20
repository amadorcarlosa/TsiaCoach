namespace TsiaCoach.WebApi.PlaygroundEvents;

public sealed record PlaygroundRejectionSummary(string Type, string Reason, int Count);

/// <summary>The same refusal, repeated and not yet overcome by a successful action of that type.</summary>
public sealed record PlaygroundStuckSignal(string Type, string Reason, int Repeats);

public sealed record PlaygroundEventSummary(
    string SessionId,
    string Playground,
    int EventCount,
    int AppliedCount,
    int RejectedCount,
    IReadOnlyDictionary<string, int> CountsByType,
    IReadOnlyList<PlaygroundRejectionSummary> Rejections,
    double TimeOnTaskSeconds,
    DateTimeOffset? FirstEventAt,
    DateTimeOffset? LastEventAt,
    IReadOnlyList<PlaygroundEventRecord> Recent,
    IReadOnlyList<PlaygroundStuckSignal> StuckSignals,
    IReadOnlyDictionary<string, int>? LatestSceneSummary);

/// <summary>What agents read instead of the raw stream.</summary>
public static class PlaygroundEventSummaryProjector
{
    public const int RecentCount = 10;
    public const int StuckThreshold = 3;

    /// <summary>Longer pauses count as time away, not time on task.</summary>
    public static readonly TimeSpan IdleGap = TimeSpan.FromMinutes(5);

    public static PlaygroundEventSummary Project(PlaygroundSession session, IReadOnlyList<PlaygroundEventRecord> events)
    {
        Dictionary<string, int> countsByType = new(StringComparer.Ordinal);
        Dictionary<(string Type, string Reason), int> rejections = [];
        // Repeats of each refusal since the last success of its type.
        Dictionary<(string Type, string Reason), int> unresolved = [];
        TimeSpan onTask = TimeSpan.Zero;
        PlaygroundEventRecord? previous = null;
        IReadOnlyDictionary<string, int>? latestScene = null;
        int applied = 0;

        foreach (PlaygroundEventRecord record in events)
        {
            countsByType[record.Type] = countsByType.GetValueOrDefault(record.Type) + 1;
            if (record.Outcome == "rejected")
            {
                (string, string) key = (record.Type, record.Reason ?? "");
                rejections[key] = rejections.GetValueOrDefault(key) + 1;
                unresolved[key] = unresolved.GetValueOrDefault(key) + 1;
            }
            else
            {
                applied++;
                foreach ((string Type, string Reason) key in unresolved.Keys.Where(key => key.Type == record.Type).ToArray())
                {
                    unresolved.Remove(key);
                }
            }

            if (previous is not null)
            {
                TimeSpan gap = record.At - previous.At;
                if (gap > TimeSpan.Zero)
                {
                    onTask += gap < IdleGap ? gap : IdleGap;
                }
            }

            latestScene = record.SceneSummary ?? latestScene;
            previous = record;
        }

        return new PlaygroundEventSummary(
            session.Id,
            session.Playground,
            events.Count,
            applied,
            events.Count - applied,
            countsByType,
            rejections
                .OrderByDescending(pair => pair.Value)
                .ThenBy(pair => pair.Key.Type, StringComparer.Ordinal)
                .Select(pair => new PlaygroundRejectionSummary(pair.Key.Type, pair.Key.Reason, pair.Value))
                .ToArray(),
            onTask.TotalSeconds,
            events.Count > 0 ? events.Min(record => record.At) : null,
            events.Count > 0 ? events.Max(record => record.At) : null,
            events.Skip(Math.Max(0, events.Count - RecentCount)).ToArray(),
            unresolved
                .Where(pair => pair.Value >= StuckThreshold)
                .OrderByDescending(pair => pair.Value)
                .Select(pair => new PlaygroundStuckSignal(pair.Key.Type, pair.Key.Reason, pair.Value))
                .ToArray(),
            latestScene);
    }
}
