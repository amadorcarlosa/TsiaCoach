using Microsoft.Agents.AI;

namespace AIInCSharp.WebApi.Runtime;

public interface IAgentTurnRunner
{
    Task<AgentResponse> RunAsync(
        AIAgent agent,
        string prompt,
        AgentSession session,
        CancellationToken cancellationToken = default);
}