using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.EndPoints;

public static class RodEndpoints
{
    public static RouteGroupBuilder MapRods(this RouteGroupBuilder api)
    {
        api.MapGet("/rods", () => TypedResults.Ok(RodCatalogResponse.Create()))
            .WithName("GetRodCatalog")
            .WithTags("Rods");
        return api;
    }
}
