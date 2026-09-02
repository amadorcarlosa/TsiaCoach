using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using TsiaCoach.Domain.Attempts;
using TsiaCoach.WebApi.CoachingAgents;
using TsiaCoach.WebApi.Request;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.EndPoints;

public static class CoachEndpoints
{
    public static RouteGroupBuilder MapCoaching(
        this RouteGroupBuilder api)
    {
        api.MapPost("/attempts/{attemptId}/coach", Coach)
            .WithName("CoachAttempt")
            .WithTags("Coach")
            .Produces<CoachTurnResponse>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
            .Produces<ProblemDetails>(StatusCodes.Status429TooManyRequests)
            .Produces<ProblemDetails>(499)
            .Produces<ProblemDetails>(StatusCodes.Status502BadGateway);

        return api;
    }

    private static async Task<IResult> Coach(
        string attemptId,
        CoachTurnRequest request,
        CoachingTurnService service,
        CancellationToken cancellationToken)
    {
        CoachingTurnResult result = await service.RunAsync(
            new AttemptId(attemptId),
            request,
            cancellationToken);

        return result.Kind switch
        {
            CoachingTurnResultKind.Succeeded =>
                TypedResults.Ok(result.Response!),
            CoachingTurnResultKind.BadRequest =>
                TypedResults.BadRequest(Problem(
                    StatusCodes.Status400BadRequest,
                    "Coaching request is malformed or unsupported.")),
            CoachingTurnResultKind.NotFound =>
                TypedResults.NotFound(Problem(
                    StatusCodes.Status404NotFound,
                    "Attempt not found.")),
            CoachingTurnResultKind.Conflict =>
                TypedResults.Conflict(Problem(
                    StatusCodes.Status409Conflict,
                    "Coaching event is not legal in the current attempt phase.")),
            CoachingTurnResultKind.RateLimited =>
                TypedResults.Problem(
                    statusCode: StatusCodes.Status429TooManyRequests,
                    title: "The model provider rate-limited the request"),
            CoachingTurnResultKind.Cancelled =>
                TypedResults.StatusCode(499),
            CoachingTurnResultKind.ProviderFailure =>
                TypedResults.Problem(
                    statusCode: StatusCodes.Status502BadGateway,
                    title: "The model provider failed the coaching turn"),
            CoachingTurnResultKind.InvalidModelOutput =>
                TypedResults.Problem(
                    statusCode: StatusCodes.Status502BadGateway,
                    title: "The model response was invalid"),
            _ => throw new InvalidOperationException(
                $"Unsupported coaching turn result '{result.Kind}'.")
        };
    }

    private static ProblemDetails Problem(int status, string title) => new()
    {
        Status = status,
        Title = title
    };
}
