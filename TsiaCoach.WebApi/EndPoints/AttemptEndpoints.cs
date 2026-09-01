using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.WebApi.Attempts;
using TsiaCoach.WebApi.Request;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.EndPoints;

public static class AttemptEndpoints
{
    public static RouteGroupBuilder MapAttempts(
        this RouteGroupBuilder api,
        SamplePracticeCatalog catalog,
        InMemoryAttemptStore store)
    {
        RouteGroupBuilder attempts = api.MapGroup("/attempts");

        attempts.MapPost("/", Start)
            .WithName("StartAttempt")
            .WithTags("Attempts")
            .Produces<AttemptProjectionResponse>(StatusCodes.Status201Created)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);

        attempts.MapGet("/{attemptId}", Read)
            .WithName("GetAttempt")
            .WithTags("Attempts")
            .Produces<AttemptProjectionResponse>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);

        attempts.MapPost("/{attemptId}/checks", Check)
            .WithName("CheckAttemptAnswer")
            .WithTags("Attempts")
            .Produces<AttemptProjectionResponse>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);

        return api;

        static Results<Created<AttemptProjectionResponse>, BadRequest<ProblemDetails>, NotFound<ProblemDetails>> Start(
            StartAttemptRequest request,
            SamplePracticeCatalog catalog,
            InMemoryAttemptStore store)
        {
            if (string.IsNullOrWhiteSpace(request.PracticeItemId))
            {
                return TypedResults.BadRequest(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Practice item ID is required."
                });
            }

            if (!catalog.TryFind(request.PracticeItemId, out PracticeItemCatalogEntry? entry))
            {
                return TypedResults.NotFound(new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Practice item not found."
                });
            }

            Attempt attempt = store.Start(entry.Item);
            AttemptProjectionResponse projection = AttemptProjectionMapper.ToResponse(
                attempt,
                entry.Item,
                entry.CoachingPolicy);

            return TypedResults.Created($"/api/attempts/{attempt.Id.Value}", projection);
        }

        static Results<Ok<AttemptProjectionResponse>, NotFound<ProblemDetails>> Read(
            string attemptId,
            SamplePracticeCatalog catalog,
            InMemoryAttemptStore store)
        {
            if (!store.TryGet(new AttemptId(attemptId), out Attempt? attempt) ||
                !catalog.TryFind(attempt.PracticeItemId.Value, out PracticeItemCatalogEntry? entry))
            {
                return TypedResults.NotFound(new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Attempt not found."
                });
            }

            return TypedResults.Ok(AttemptProjectionMapper.ToResponse(
                attempt,
                entry.Item,
                entry.CoachingPolicy));
        }

        static Results<Ok<AttemptProjectionResponse>, BadRequest<ProblemDetails>, NotFound<ProblemDetails>, Conflict<ProblemDetails>> Check(
            string attemptId,
            CheckAnswerRequest request,
            SamplePracticeCatalog catalog,
            InMemoryAttemptStore store)
        {
            if (string.IsNullOrWhiteSpace(request.SelectedAnswerId))
            {
                return TypedResults.BadRequest(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Selected answer ID is required."
                });
            }

            if (!store.TryGet(new AttemptId(attemptId), out Attempt? attempt) ||
                !catalog.TryFind(attempt.PracticeItemId.Value, out PracticeItemCatalogEntry? entry))
            {
                return TypedResults.NotFound(new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Attempt not found."
                });
            }

            AppendAttemptResult result = store.Append(
                attempt.Id,
                entry.Item,
                new AnswerChoiceId(request.SelectedAnswerId));

            return result.Kind switch
            {
                AppendAttemptResultKind.UnknownAttempt => TypedResults.NotFound(new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Attempt not found."
                }),
                AppendAttemptResultKind.ForeignAnswerChoice => TypedResults.BadRequest(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Answer choice does not belong to the practice item."
                }),
                AppendAttemptResultKind.AlreadyCorrect => TypedResults.Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Attempt is already correct."
                }),
                AppendAttemptResultKind.Appended => TypedResults.Ok(
                    AttemptProjectionMapper.ToResponse(
                        result.Attempt!,
                        entry.Item,
                        entry.CoachingPolicy)),
                _ => throw new InvalidOperationException("Unsupported append result.")
            };
        }
    }
}
