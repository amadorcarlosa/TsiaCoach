using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;

namespace TsiaCoach.WebApi.Agents;

public interface IAgentExecutor
{
    Task<AgentReply> RunAsync(
        AIAgent agent,
        string model,
        IReadOnlyList<ChatMessage> messages,
        CancellationToken cancellationToken,
        ChatResponseFormat? responseFormat = null);
}
