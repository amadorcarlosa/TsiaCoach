using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.EndPoints;

public static class ModelsEndpoint
{
    public static RouteGroupBuilder MapModels(this RouteGroupBuilder group)
    {
        group.MapGet("/models", (TsiaCoach.WebApi.Agents.AgentFactory factory) => TypedResults.Ok(factory.AvailableModels))
            .WithName("GetModels")
            .WithTags("Models");
        return group;
    }
}
