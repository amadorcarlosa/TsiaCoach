using Azure;
using Microsoft.Agents.AI;
using ChatMessage = Microsoft.Extensions.AI.ChatMessage;
namespace AIInCSharp.WebApi;

public static class ChatLoop
{
    public static async Task RunSample(ChatClientAgent agent)
    {
      
        try
        {
            AgentSession session = await agent.CreateSessionAsync();

            while (true)
            {
                Console.Write("> ");
                string input = Console.ReadLine() ?? "";
                List<AgentResponseUpdate> updates = [];
                await foreach (AgentResponseUpdate update in agent.RunStreamingAsync(input, session))
                {
                    updates.Add(update);
                    Console.WriteLine(update);
                }

                AgentResponse response = updates.ToAgentResponse();
                if (response.Usage != null)
                {
                    Console.WriteLine(response); 
                    Output.Gray(
                        $" Tokens - In: " +
                        $"{response.Usage.InputTokenCount}" +
                        $"- Out:{response.Usage.OutputTokenCount}");
                }
                InMemoryChatHistoryProvider? historyProvider=agent.GetService<InMemoryChatHistoryProvider>();
                IList<ChatMessage> messageForSession = historyProvider?.GetMessages((session)) ?? [];
                Output.Separator();

            }
        }
        catch (RequestFailedException ex)
        {
            Console.WriteLine(ex.Message);
            
        }

    }

}