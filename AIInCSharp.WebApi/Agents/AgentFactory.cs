namespace AIInCSharp.WebApi.Agents;

public sealed class AgentFactory(ModelClient clients)
{
    public AgentCreation Create(
        string model,
        string instructions)
    {
        ModelDescriptor? descriptor = ModelCatalog.Find(model);

        if (descriptor is null)
        {
            var error = new AgentError(
                new UnknownModel(model));

            return new AgentCreation(error);
        }

        var agent = descriptor.Vendor.CreateAgent(
            clients,
            descriptor.Name,
            instructions);

        return new AgentCreation(
            new MyAgent(agent));
    }
}