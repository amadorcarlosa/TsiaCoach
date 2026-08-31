using Microsoft.Agents.AI;

namespace TsiaCoach.WebApi.Runtime;

public interface IAgentTurnRunner
{
    Task<AgentResponse> RunAsync(
        AIAgent agent,
        string prompt,
        AgentSession session,
        CancellationToken cancellationToken = default);
}