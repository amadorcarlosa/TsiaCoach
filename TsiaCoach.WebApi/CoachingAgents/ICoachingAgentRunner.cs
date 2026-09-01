using TsiaCoach.WebApi.Agents;

namespace TsiaCoach.WebApi.CoachingAgents;

public interface ICoachingAgentRunner
{
    Task<CoachingAgentRunResult> RunAsync(
        CoachingAgentDefinition definition,
        CancellationToken cancellationToken);
}

public sealed record CoachingAgentRunResult
{
    private CoachingAgentRunResult(
        string? text,
        AgentError? error)
    {
        Text = text;
        Error = error;
    }

    public string? Text { get; }

    public AgentError? Error { get; }

    public bool Succeeded => Error is null;

    public static CoachingAgentRunResult FromText(string text) =>
        new(text, null);

    public static CoachingAgentRunResult FromError(AgentError error) =>
        new(null, error);
}
