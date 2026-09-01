using Microsoft.Extensions.AI;
using TsiaCoach.WebApi.Agents;

namespace TsiaCoach.WebApi.CoachingAgents;

public sealed class CoachingAgentRunner(
    AgentFactory agentFactory,
    IAgentExecutor agentExecutor)
    : ICoachingAgentRunner
{
    public async Task<CoachingAgentRunResult> RunAsync(
        CoachingAgentDefinition definition,
        CancellationToken cancellationToken)
    {
        AgentCreation creation = agentFactory.Create(
            definition.Model,
            definition.SystemPrompt);

        return creation switch
        {
            MyAgent created => await RunCreatedAsync(
                created,
                definition,
                cancellationToken),
            AgentError error => CoachingAgentRunResult.FromError(error),
            _ => throw new InvalidOperationException(
                "Unsupported agent creation result.")
        };
    }

    private async Task<CoachingAgentRunResult> RunCreatedAsync(
        MyAgent created,
        CoachingAgentDefinition definition,
        CancellationToken cancellationToken)
    {
        ChatMessage[] messages =
        [
            new(ChatRole.User, definition.Prompt)
        ];

        AgentReply reply = await agentExecutor.RunAsync(
            created.Agent,
            definition.Model,
            messages,
            cancellationToken);

        return reply switch
        {
            Reply value => CoachingAgentRunResult.FromText(value.Text),
            AgentError error => CoachingAgentRunResult.FromError(error),
            _ => throw new InvalidOperationException(
                "Unsupported agent execution result.")
        };
    }
}
