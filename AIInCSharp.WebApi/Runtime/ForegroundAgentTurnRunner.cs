using Microsoft.Agents.AI;

namespace AIInCSharp.WebApi.Runtime;

public sealed class ForegroundAgentTurnRunner : IAgentTurnRunner
{
    public Task<AgentResponse> RunAsync(
        AIAgent agent,
        string prompt,
        AgentSession session,
        CancellationToken cancellationToken = default)
    {
        return agent.RunAsync(
            prompt,
            session,
            cancellationToken: cancellationToken);
    }
}