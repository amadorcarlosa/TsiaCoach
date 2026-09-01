using Microsoft.AspNetCore.Http.HttpResults;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.EndPoints;

public static class SampleQuestionEndpoints
{
    private static readonly IReadOnlyList<PracticeItem> Items =
    [
        PracticeItemOne.Item,
        PracticeItemTwo.Item
    ];

    public static RouteGroupBuilder MapSampleQuestions(this RouteGroupBuilder api)
    {
        RouteGroupBuilder questions = api.MapGroup("/sample-questions");

        questions.MapGet("/", GetAll)
            .WithName("GetSampleQuestions")
            .WithTags("Sample Questions")
            .Produces<PracticeItemResponse[]>(StatusCodes.Status200OK);

        questions.MapGet("/{id}", GetById)
            .WithName("GetSampleQuestionById")
            .WithTags("Sample Questions")
            .Produces<PracticeItemResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        return api;
    }

    private static Ok<PracticeItemResponse[]> GetAll() =>
        TypedResults.Ok(Items.Select(SampleQuestionResponseMapper.ToResponse).ToArray());

    private static Results<Ok<PracticeItemResponse>, NotFound> GetById(string id)
    {
        PracticeItem? item = Items.FirstOrDefault(candidate =>
            string.Equals(candidate.Id.Value, id, StringComparison.Ordinal));

        return item is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(SampleQuestionResponseMapper.ToResponse(item));
    }
}
