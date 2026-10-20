namespace TsiaCoach.WebApi.Agents;

using Microsoft.Agents.AI;
using OpenAI;
using OpenAI.Chat;
using TsiaCoach.WebApi.Response;

public sealed class AgentFactory
{
    private readonly ModelClient? _foundryClients;
    private readonly OpenAIClient? _openRouterClient;

    public IReadOnlyList<FoundryDeploymentResponse> AvailableModels { get; }

    public AgentFactory(ModelClient clients)
    {
        _foundryClients = clients;
        AvailableModels = FoundryDeployments.All;
    }

    public AgentFactory(OpenAIClient client, IReadOnlyList<FoundryDeploymentResponse> models)
    {
        _openRouterClient = client;
        AvailableModels = models.ToArray();
    }

    public AgentCreation Create(
        string model,
        string instructions)
    {
        if (_openRouterClient is not null)
        {
            if (!AvailableModels.Any(candidate => candidate.Name == model))
                return new AgentCreation(new AgentError(new UnknownModel(model)));

            var routerAgent = _openRouterClient.GetChatClient(model)
                .AsAIAgent(instructions: instructions, name: "assistant")
                .AsBuilder()
                .UseOpenTelemetry(
                    sourceName: AgentTelemetry.SourceName,
                    configure: telemetry => telemetry.EnableSensitiveData = false)
                .Build();

            return new AgentCreation(new MyAgent(routerAgent));
        }

        ModelDescriptor? descriptor = ModelCatalog.Find(model);

        if (descriptor is null)
        {
            var error = new AgentError(
                new UnknownModel(model));

            return new AgentCreation(error);
        }

        var agent = descriptor.Vendor.CreateAgent(
            _foundryClients!,
            descriptor.Name,
            instructions);

        return new AgentCreation(
            new MyAgent(agent));
    }
}
