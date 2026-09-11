using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.EndPoints;

public static class BaseTenBlockEndpoints
{
    public static RouteGroupBuilder MapBaseTenBlocks(this RouteGroupBuilder api)
    {
        api.MapGet("/base-ten-blocks", () => TypedResults.Ok(BaseTenBlockCatalogResponse.Create()))
            .WithName("GetBaseTenBlockCatalog")
            .WithTags("BaseTenBlocks");
        return api;
    }
}
