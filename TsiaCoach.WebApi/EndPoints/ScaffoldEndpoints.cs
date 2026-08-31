using Microsoft.AspNetCore.Http.HttpResults;
using TsiaCoach.Domain.SampleScaffolds;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.EndPoints;

public static class ScaffoldEndpoints
{
    private static readonly IReadOnlyList<Scaffold> Scaffolds =
    [
        ParityLadderScaffold.Definition
    ];

    public static RouteGroupBuilder MapScaffolds(this RouteGroupBuilder api)
    {
        RouteGroupBuilder scaffolds = api.MapGroup("/scaffolds");

        scaffolds.MapGet("/", GetAll)
            .WithName("GetScaffolds")
            .WithTags("Scaffolds")
            .Produces<ScaffoldResponse[]>(StatusCodes.Status200OK);

        scaffolds.MapGet("/{id}", GetById)
            .WithName("GetScaffoldById")
            .WithTags("Scaffolds")
            .Produces<ScaffoldResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        return api;
    }

    private static Ok<ScaffoldResponse[]> GetAll() =>
        TypedResults.Ok(Scaffolds
            .Select(ScaffoldResponseMapper.ToResponse)
            .ToArray());

    private static Results<Ok<ScaffoldResponse>, NotFound> GetById(string id)
    {
        Scaffold? scaffold = Scaffolds.FirstOrDefault(candidate =>
            string.Equals(candidate.Id.Value, id, StringComparison.Ordinal));

        return scaffold is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(ScaffoldResponseMapper.ToResponse(scaffold));
    }
}
