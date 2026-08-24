using System.ClientModel;
using System.Text;
using AIInCSharp.WebApi.Agents;
using Anthropic;
using Azure;
using Microsoft.Agents.AI;
using OpenAI.Responses;

namespace AIInCSharp.WebApi;

public static class Instructions
{
    public static async Task RunSample(ModelClient client)
    {
        Console.OutputEncoding = Encoding.UTF8;
      
        Console.Write("Enter Instructions> ");
        string? rawInstructions= Console.ReadLine();
      
        

       
        


        while (true)
        {
            string model = ModelExtension.PromptForModel();
           
            AIAgent agent = model == Models.Claude.Model.Opus.Version.Five.Name
                ? client.AnthropicFoundryClient.AsAIAgent(model, rawInstructions, "assistant")
                : client.OpenAiClient.GetResponsesClient().AsAIAgent(model, rawInstructions, "assistant");

            AgentSession session = await agent.CreateSessionAsync();
            Console.Write("Enter prompt> ");
            string? rawInput = Console.ReadLine();
            if (string.IsNullOrWhiteSpace(rawInput))
            {
                Console.Write("Please Enter prompt> ");
                rawInput = Console.ReadLine();
            }

            if (string.IsNullOrWhiteSpace(rawInput))
            {
                rawInput = "User did not enter anything use context to provide response";
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

                if (response.Usage != null)
                {
                    Output.Gray(
                        $" Tokens - In: " +
                        $"{response.Usage.InputTokenCount}" +
                        $"- Out:{response.Usage.OutputTokenCount}");
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
