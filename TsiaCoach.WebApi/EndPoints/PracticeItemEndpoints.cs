using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.WebApi.Attempts;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.EndPoints;

public static class PracticeItemEndpoints
{
    public static RouteGroupBuilder MapPracticeItems(
        this RouteGroupBuilder api,
        SamplePracticeCatalog catalog)
    {
        RouteGroupBuilder items = api.MapGroup("/practice-items");

        items.MapGet("/", () => TypedResults.Ok(
                catalog.Items
                    .Select(SampleQuestionResponseMapper.ToPromptResponse)
                    .ToArray()))
            .WithName("GetPracticeItems")
            .WithTags("Practice Items")
            .Produces<PracticeItemPromptResponse[]>(StatusCodes.Status200OK);

        items.MapGet("/{id}", GetById)
            .WithName("GetPracticeItemById")
            .WithTags("Practice Items")
            .Produces<PracticeItemPromptResponse>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);

        return api;

        static Results<Ok<PracticeItemPromptResponse>, NotFound<ProblemDetails>> GetById(
            string id,
            SamplePracticeCatalog catalog)
        {
            if (!catalog.TryFind(id, out PracticeItemCatalogEntry? entry))
            {
                return TypedResults.NotFound(new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Practice item not found."
                });
            }

            return TypedResults.Ok(SampleQuestionResponseMapper.ToPromptResponse(entry.Item));
        }
    }
}
