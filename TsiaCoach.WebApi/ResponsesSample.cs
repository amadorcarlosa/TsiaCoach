using System.ClientModel;
using System.Text;
using Azure;
using Azure.AI.OpenAI;
using Azure.Core;
using Microsoft.Agents.AI;
using OpenAI.Responses;

namespace TsiaCoach.WebApi;

public static class ResponsesSample
{
    public static AIAgent CreateAgent(
        Uri endpoint,
        TokenCredential credential,
        string modelName,
        string instructions = "")
    {
        AzureOpenAIClient azureClient = new(endpoint, credential);

        // Unlike GetChatClient, the Responses endpoint is not deployment-scoped:
        // the model is chosen per request, so it goes on the agent, not the client.
        ResponsesClient responseClient = azureClient.GetResponsesClient();

        return responseClient.AsAIAgent(model: modelName, instructions: instructions);
    }

    public static async Task RunSample(AIAgent agent)
    {
        Console.OutputEncoding = Encoding.UTF8;

        AgentSession session = await agent.CreateSessionAsync();
        while (true)
        {
            Console.Write("Enter prompt> ");
            string? rawInput = Console.ReadLine();
            if (string.IsNullOrWhiteSpace(rawInput))
            {
                break;
            }

            string input = rawInput.Trim();
            if (input.Equals("exit", StringComparison.OrdinalIgnoreCase) ||
                input.Equals("quit", StringComparison.OrdinalIgnoreCase))
            {
                break;
            }

            try
            {
                AgentResponse response = await agent.RunAsync(input, session);
                Output.Magenta(response.Text);

                // Responses API returns a server-side response id each turn —
                // visible proof this loop is NOT going through Chat Completions.
                if (response.ResponseId is not null)
                {
                    Output.Gray($" ResponseId: {response.ResponseId}");
                }

                if (response.Usage != null)
                {
                    Output.Gray(
                        $" Tokens - In: " +
                        $"{response.Usage.InputTokenCount}" +
                        $" - Out: {response.Usage.OutputTokenCount}");
                }
            }
            catch (Exception ex) when (ex is RequestFailedException or ClientResultException)
            {
                await Console.Error.WriteLineAsync($"Error: {ex.Message}");
            }

            Output.Separator();
        }
    }
}
