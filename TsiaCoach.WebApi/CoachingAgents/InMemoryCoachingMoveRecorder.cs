namespace TsiaCoach.WebApi.CoachingAgents;

public sealed class InMemoryCoachingMoveRecorder : ICoachingMoveRecorder
{
    private readonly Lock gate = new();
    private readonly List<CoachingMoveRecord> records = [];

    public void Record(CoachingMoveRecord record)
    {
        lock (gate)
        {
            records.Add(record);
        }
    }

    public IReadOnlyList<CoachingMoveRecord> Snapshot()
    {
        lock (gate)
        {
            return records.ToList().AsReadOnly();
        }
    }
}
