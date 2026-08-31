using Microsoft.Agents.AI;

namespace TsiaCoach.WebApi.Agents;

public static class AgentExtensions
{
    public static async Task<AgentResponse> RunWithBackgroundResponsesAsync(
        this AIAgent agent,
        string prompt,
        AgentSession session,
        TimeSpan? pollInterval = null,
        IProgress<TimeSpan>? progress = null,
        CancellationToken cancellationToken = default)
    {
        TimeSpan delay =
            pollInterval ?? TimeSpan.FromSeconds(2);

        var options = new ChatClientAgentRunOptions
        {
            AllowBackgroundResponses = true
        };

        // Initial request.
        AgentResponse response = await agent.RunAsync(
            prompt,
            session,
            options: options,
            cancellationToken: cancellationToken);

        TimeSpan totalWait = TimeSpan.Zero;

        // Poll until the continuation token disappears.
        while (response.ContinuationToken is { } token)
        {
            await Task.Delay(delay, cancellationToken);

            totalWait += delay;
            progress?.Report(totalWait);

            // Important: no prompt is supplied here.
            response = await agent.RunAsync(
                session,
                options: new ChatClientAgentRunOptions
                {
                    ContinuationToken = token
                },
                cancellationToken: cancellationToken);
        }

        return response;
    }
}