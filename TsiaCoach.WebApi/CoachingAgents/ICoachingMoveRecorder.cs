namespace TsiaCoach.WebApi.CoachingAgents;

public interface ICoachingMoveRecorder
{
    void Record(CoachingMoveRecord record);

    IReadOnlyList<CoachingMoveRecord> Snapshot();
}
