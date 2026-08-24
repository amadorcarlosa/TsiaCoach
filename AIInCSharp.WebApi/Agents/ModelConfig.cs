using Anthropic.Foundry;
using Azure.AI.OpenAI;
using Azure.Core;

namespace AIInCSharp.WebApi.Agents;



public sealed record AzureOpenAIConfig(
    Uri Endpoint,
    TokenCredential TokenCredential);

public sealed record AzureAnthropicModelConfig(
    FoundryTokenCredential FoundryTokenCredential);

public sealed record ModelClient(AzureOpenAIClient OpenAiClient, AnthropicFoundryClient AnthropicFoundryClient);


public sealed record  ModelConfig(AzureOpenAIConfig AzureOpenAiConfig,AzureAnthropicModelConfig AzureAnthropicModelConfig);

public static class ModelConfigExtension
{
    public static ClientCreation CreateModelClient(this ModelConfig config) =>
        new ClientCreation(new ModelClient( 
            config.AzureOpenAiConfig.AddAzureOpenAiClient(),
            config.AzureAnthropicModelConfig.AddAnthropicFoundryClient())
            );    
    static AzureOpenAIClient AddAzureOpenAiClient(this AzureOpenAIConfig config) =>
    new(config.Endpoint, config.TokenCredential);
    
    static AnthropicFoundryClient AddAnthropicFoundryClient(this AzureAnthropicModelConfig config) =>
    new(config.FoundryTokenCredential);
    
    
    


}