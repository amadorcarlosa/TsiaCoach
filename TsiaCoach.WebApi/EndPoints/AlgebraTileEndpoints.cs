using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.EndPoints;

public static class AlgebraTileEndpoints
{
    public static RouteGroupBuilder MapAlgebraTiles(this RouteGroupBuilder api)
    {
        api.MapGet("/algebra-tiles", () => TypedResults.Ok(AlgebraTileCatalogResponse.Create()))
            .WithName("GetAlgebraTileCatalog")
            .WithTags("AlgebraTiles");
        return api;
    }
}
