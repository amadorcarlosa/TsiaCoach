using Microsoft.AspNetCore.Http.HttpResults;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.WebApi.Attempts;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.EndPoints;

public static class ScaffoldEndpoints
{
    public static RouteGroupBuilder MapScaffolds(
        this RouteGroupBuilder api,
        SamplePracticeCatalog catalog)
    {
        RouteGroupBuilder scaffolds = api.MapGroup("/scaffolds");

        scaffolds.MapGet("/", () => GetAll(catalog))
            .WithName("GetScaffolds")
            .WithTags("Scaffolds")
            .Produces<ScaffoldResponse[]>(StatusCodes.Status200OK);

        scaffolds.MapGet("/{id}", (string id) => GetById(id, catalog))
            .WithName("GetScaffoldById")
            .WithTags("Scaffolds")
            .Produces<ScaffoldResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        return api;
    }

    private static Ok<ScaffoldResponse[]> GetAll(
        SamplePracticeCatalog catalog) =>
        TypedResults.Ok(catalog.Scaffolds
            .Select(ScaffoldResponseMapper.ToResponse)
            .ToArray());

    private static Results<Ok<ScaffoldResponse>, NotFound> GetById(
        string id,
        SamplePracticeCatalog catalog)
    {
        Scaffold? scaffold = catalog.TryFindScaffold(id, out Scaffold found)
            ? found
            : null;

        return scaffold is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(ScaffoldResponseMapper.ToResponse(scaffold));
    }
}
