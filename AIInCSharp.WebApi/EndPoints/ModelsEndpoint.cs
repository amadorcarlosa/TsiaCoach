using AIInCSharp.WebApi.Response;

namespace AIInCSharp.WebApi.EndPoints;

public static class ModelsEndpoint
{
    public static RouteGroupBuilder MapModels(this RouteGroupBuilder group)
    {
        group.MapGet("/models", () => TypedResults.Ok(FoundryDeployments.All))
            .WithName("GetModels")
            .WithTags("Models");
        return group;
    }
}