using TsiaCoach.WebApi.Agents;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;


namespace TsiaCoach.WebApi.Tests;

public sealed class FakeAgentExecutor : IAgentExecutor
{
    public AgentReply? Result { get; set; }

    public int CallCount { get; private set; }

    public string? LastModel { get; private set; }

    public IReadOnlyList<ChatMessage>? LastMessages
    {
        get;
        private set;
    }

    public CancellationToken LastCancellationToken
    {
        get;
        private set;
    }

    public ChatResponseFormat? LastResponseFormat
    {
        get;
        private set;
    }

    public Task<AgentReply> RunAsync(
        AIAgent agent,
        string model,
        IReadOnlyList<ChatMessage> messages,
        CancellationToken cancellationToken,
        ChatResponseFormat? responseFormat = null)
    {
        CallCount++;
        LastModel = model;
        LastMessages = messages.ToArray();
        LastCancellationToken = cancellationToken;
        LastResponseFormat = responseFormat;

        AgentReply result =
            Result
            ?? throw new InvalidOperationException(
                "Configure FakeAgentExecutor.Result before sending the request.");

        return Task.FromResult(result);
    }
}
