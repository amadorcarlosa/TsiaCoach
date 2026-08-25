using Anthropic;
using Microsoft.Agents.AI;
using OpenAI.Responses;

namespace AIInCSharp.WebApi.Agents;

public enum VendorName
{
    Anthropic,
    OpenAI,
    DeepSeek
}

public sealed record OpenAIVendor;
public sealed record AnthropicVendor;
public sealed record DeepSeekVendor;

public union Vendor(OpenAIVendor, AnthropicVendor, DeepSeekVendor)
{
    public VendorName WireName => this switch
    {
        OpenAIVendor => VendorName.OpenAI,
        AnthropicVendor => VendorName.Anthropic,
        DeepSeekVendor => VendorName.DeepSeek
    };
    
    public AIAgent CreateAgent(
        ModelClient clients,
        string model,
        string instructions)
    {
        AIAgent agent = this switch
        {
            OpenAIVendor =>
                clients.OpenAiClient
                    .GetResponsesClient()
                    .AsAIAgent(model, instructions, "assistant"),

            AnthropicVendor =>
                clients.AnthropicFoundryClient
                    .AsAIAgent(model, instructions, "assistant"),

            // This is deliberately isolated until DeepSeek-V4-Pro is probed.
            DeepSeekVendor =>
                CreateDeepSeekAgent(clients, model, instructions)
        };

        return agent
            .AsBuilder()
            .UseOpenTelemetry(
                sourceName: AgentTelemetry.SourceName,
                configure: telemetry =>
                    telemetry.EnableSensitiveData = false)
            .Build();
    }

    private static AIAgent CreateDeepSeekAgent(
        ModelClient clients,
        string model,
        string instructions)
    {
        // Initial hypothesis: Foundry exposes this deployment through Responses.
        // Replace only this method if the probe requires Chat Completions.
        return clients.OpenAiClient
            .GetResponsesClient()
            .AsAIAgent(model, instructions, "assistant");
    }
}
