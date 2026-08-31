using System.Text;
using Microsoft.Agents.AI;

namespace TsiaCoach.WebApi.Runtime;

public sealed class ConsoleAgentRuntime
{
    private readonly IAgentTurnRunner _turnRunner;

    public ConsoleAgentRuntime(IAgentTurnRunner turnRunner)
    {
        _turnRunner = turnRunner;
    }

    public async Task RunAsync(
        AIAgent agent,
        CancellationToken cancellationToken = default)
    {
        Console.OutputEncoding = Encoding.UTF8;

        AgentSession session =
            await agent.CreateSessionAsync(cancellationToken);

        while (!cancellationToken.IsCancellationRequested)
        {
            Console.Write("Enter prompt> ");

            string? input = Console.ReadLine()?.Trim();

            if (string.IsNullOrWhiteSpace(input) || IsExitCommand(input))
            {
                break;
            }

            try
            {
                AgentResponse response = await _turnRunner.RunAsync(
                    agent,
                    input,
                    session,
                    cancellationToken);

                Output.Magenta(response.Text);
                WriteUsage(response);
            }
            catch (OperationCanceledException)
                when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                // This is the console/application boundary, so it can handle
                // exceptions from different providers.
                await Console.Error.WriteLineAsync(
                    $"Error: {exception.Message}");
            }

            Output.Separator();
        }
    }

    private static bool IsExitCommand(string input) =>
        input.Equals("exit", StringComparison.OrdinalIgnoreCase) ||
        input.Equals("quit", StringComparison.OrdinalIgnoreCase);

    private static void WriteUsage(AgentResponse response)
    {
        if (response.Usage is null)
        {
            return;
        }

        Output.Gray(
            $"Tokens - In: {response.Usage.InputTokenCount}" +
            $" - Out: {response.Usage.OutputTokenCount}");
    }
}