using AIInCSharp.WebApi.Agents;
using Microsoft.Agents.AI;

namespace AIInCSharp.WebApi.Runtime;





public sealed class BackgroundAgentTurnRunner : IAgentTurnRunner
{
    private readonly TimeSpan _pollInterval;
    private readonly IProgress<TimeSpan>? _progress;

    public BackgroundAgentTurnRunner(
        TimeSpan? pollInterval = null,
        IProgress<TimeSpan>? progress = null)
    {
        _pollInterval = pollInterval ?? TimeSpan.FromSeconds(2);
        _progress = progress;
    }

    public Task<AgentResponse> RunAsync(
        AIAgent agent,
        string prompt,
        AgentSession session,
        CancellationToken cancellationToken = default)
    {
        return agent.RunWithBackgroundResponsesAsync(
            prompt,
            session,
            _pollInterval,
            _progress,
            cancellationToken);
    }
}