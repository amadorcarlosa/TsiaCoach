using System.ClientModel;
using Azure.Core;
using Azure.Identity;
using OpenAI;
using TsiaCoach.WebApi.CoachingAgents;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Agents;

public static class AgentProviderRegistration
{
    public const string OpenRouterEndpoint = "https://openrouter.ai/api/v1";

    public static IServiceCollection AddAgentProvider(
        this IServiceCollection services, IConfiguration configuration)
    {
        string provider = configuration["AgentProvider"] ?? "Foundry";
        if (provider.Equals("OpenRouter", StringComparison.OrdinalIgnoreCase))
        {
            string key = Required(configuration, "OpenRouter:ApiKey");
            string[] models = configuration.GetSection("OpenRouter:Models").Get<string[]>() ?? [];
            if (models.Length == 0 || models.Any(model =>
                    string.IsNullOrWhiteSpace(model) || model != model.Trim() ||
                    !model.Contains('/') || model.StartsWith("typesafe/", StringComparison.OrdinalIgnoreCase)) ||
                models.Distinct(StringComparer.Ordinal).Count() != models.Length)
            {
                throw new InvalidOperationException(
                    "OpenRouter:Models must contain distinct provider/model chat model IDs. " +
                    "TypeSafe decision models require the separate Decisions API.");
            }

            string coachModel = configuration["CoachingAgent:Model"] ?? models[0];
            if (!models.Contains(coachModel, StringComparer.Ordinal))
                throw new InvalidOperationException("CoachingAgent:Model must be listed in OpenRouter:Models.");

            services.AddSingleton(_ => new OpenAIClient(new ApiKeyCredential(key),
                new OpenAIClientOptions { Endpoint = new Uri(OpenRouterEndpoint) }));
            services.AddSingleton(sp => new AgentFactory(sp.GetRequiredService<OpenAIClient>(),
                models.Select(model => new FoundryDeploymentResponse(model, model, VendorName.OpenRouter)).ToArray()));
            services.PostConfigure<CoachingAgentOptions>(options => options.Model = coachModel);
            return services;
        }

        if (!provider.Equals("Foundry", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("AgentProvider must be Foundry or OpenRouter.");

        string endpoint = Required(configuration, "endpoint");
        string resource = Required(configuration, "foundryResource");
        services.AddSingleton<TokenCredential>(new ChainedTokenCredential(
            new AzureCliCredential(new AzureCliCredentialOptions { TenantId = configuration["tenantId"] }),
            new EnvironmentCredential()));
        services.AddSingleton(sp => new FoundryTokenCredential(sp.GetRequiredService<TokenCredential>(), resource));
        services.AddSingleton(sp => new ModelClient(
            new Azure.AI.OpenAI.AzureOpenAIClient(new Uri(endpoint), sp.GetRequiredService<TokenCredential>()),
            new Anthropic.Foundry.AnthropicFoundryClient(sp.GetRequiredService<FoundryTokenCredential>())));
        services.AddSingleton(sp => new AgentFactory(sp.GetRequiredService<ModelClient>()));
        return services;
    }

    private static string Required(IConfiguration configuration, string name) =>
        !string.IsNullOrWhiteSpace(configuration[name])
            ? configuration[name]!
            : throw new InvalidOperationException($"Configuration '{name}' is required.");
}
