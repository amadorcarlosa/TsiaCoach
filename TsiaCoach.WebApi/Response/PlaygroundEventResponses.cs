using TsiaCoach.WebApi.PlaygroundEvents;

namespace TsiaCoach.WebApi.Response;

public sealed record PlaygroundSessionResponse(string SessionId);

public sealed record AppendPlaygroundEventsResponse(int Accepted, int Duplicates);

public sealed record PlaygroundEventsResponse(
    string SessionId,
    string Playground,
    IReadOnlyList<PlaygroundEventRecord> Events);

/// <summary>A session with every stored event, as exported or handed to a learner on request.</summary>
public sealed record PlaygroundSessionExport(
    PlaygroundSession Session,
    IReadOnlyList<PlaygroundEventRecord> Events);
