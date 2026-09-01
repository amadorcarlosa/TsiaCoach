using System.Text.Json;

using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

using HttpJsonOptions = Microsoft.AspNetCore.Http.Json.JsonOptions;

using TsiaCoach.Domain.ScaffoldSessions;
using TsiaCoach.Domain.Scaffolds.Evaluation;
using TsiaCoach.WebApi.Request;
using TsiaCoach.WebApi.Response;
using TsiaCoach.WebApi.ScaffoldSessions;

namespace TsiaCoach.WebApi.EndPoints;

public static class ScaffoldSessionEndpoints
{
    public static RouteGroupBuilder MapScaffoldSessions(
        this RouteGroupBuilder api,
        ScaffoldSessionService service)
    {
        RouteGroupBuilder starts = api.MapGroup("/attempts/{attemptId}/scaffold-sessions");

        starts.MapPost("", Start)
            .WithName("StartScaffoldSession")
            .WithTags("Scaffold Sessions")
            .Produces<ScaffoldSessionResponse>(StatusCodes.Status201Created)
            .Produces<ScaffoldSessionResponse>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);

        RouteGroupBuilder sessions = api.MapGroup("/scaffold-sessions");

        sessions.MapGet("/{sessionId}", Read)
            .WithName("GetScaffoldSession")
            .WithTags("Scaffold Sessions")
            .Produces<ScaffoldSessionResponse>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);

        sessions.MapPost("/{sessionId}/checks", Check)
            .WithName("CheckScaffoldSession")
            .WithTags("Scaffold Sessions")
            .Produces<ScaffoldSessionResponse>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);

        return api;

        static Results<
            Created<ScaffoldSessionResponse>,
            Ok<ScaffoldSessionResponse>,
            NotFound<ProblemDetails>,
            Conflict<ProblemDetails>> Start(
            string attemptId,
            ScaffoldSessionService service)
        {
            ScaffoldSessionStartServiceResult result = service.Start(new(attemptId));

            return result.Kind switch
            {
                ScaffoldSessionStartServiceResultKind.UnknownAttempt =>
                    TypedResults.NotFound(Problem(
                        StatusCodes.Status404NotFound,
                        "Attempt not found.")),
                ScaffoldSessionStartServiceResultKind.NotAuthorized =>
                    TypedResults.Conflict(Problem(
                        StatusCodes.Status409Conflict,
                        "Attempt is not authorized to start a scaffold session.")),
                ScaffoldSessionStartServiceResultKind.Created =>
                    TypedResults.Created(
                        $"/api/scaffold-sessions/{result.Context!.Session.Id.Value}",
                        ScaffoldSessionResponseMapper.ToResponse(result.Context)),
                ScaffoldSessionStartServiceResultKind.Existing =>
                    TypedResults.Ok(
                        ScaffoldSessionResponseMapper.ToResponse(result.Context!)),
                _ => throw new InvalidOperationException(
                    "Unsupported scaffold session start service result.")
            };
        }

        static Results<Ok<ScaffoldSessionResponse>, NotFound<ProblemDetails>> Read(
            string sessionId,
            ScaffoldSessionService service)
        {
            return service.TryRead(
                    new ScaffoldSessionId(sessionId),
                    out ScaffoldSessionContext context)
                ? TypedResults.Ok(ScaffoldSessionResponseMapper.ToResponse(context))
                : TypedResults.NotFound(Problem(
                    StatusCodes.Status404NotFound,
                    "Scaffold session not found."));
        }

        static Results<
            Ok<ScaffoldSessionResponse>,
            BadRequest<ProblemDetails>,
            NotFound<ProblemDetails>,
            Conflict<ProblemDetails>> Check(
            string sessionId,
            JsonElement requestBody,
            IOptions<HttpJsonOptions> jsonOptions,
            ScaffoldSessionService service)
        {
            if (requestBody.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            {
                return TypedResults.BadRequest(Problem(
                    StatusCodes.Status400BadRequest,
                    "A scaffold submission is required."));
            }

            ScaffoldStepSubmission submission;
            try
            {
                ScaffoldStepSubmissionRequest request =
                    requestBody.Deserialize<ScaffoldStepSubmissionRequest>(
                        jsonOptions.Value.SerializerOptions)
                    ?? throw new InvalidOperationException(
                        "A scaffold submission is required.");
                submission = ScaffoldStepSubmissionRequestMapper.ToDomain(request);
            }
            catch (Exception exception) when (
                exception is ArgumentException or
                JsonException or
                InvalidOperationException or
                NotSupportedException or
                OverflowException)
            {
                return TypedResults.BadRequest(Problem(
                    StatusCodes.Status400BadRequest,
                    "Submission is malformed or incompatible."));
            }

            ScaffoldSessionCheckServiceResult result = service.Check(
                new ScaffoldSessionId(sessionId),
                submission);

            return result.Kind switch
            {
                ScaffoldSessionAppendResultKind.UnknownSession =>
                    TypedResults.NotFound(Problem(
                        StatusCodes.Status404NotFound,
                        "Scaffold session not found.")),
                ScaffoldSessionAppendResultKind.Completed =>
                    TypedResults.Conflict(Problem(
                        StatusCodes.Status409Conflict,
                        "Scaffold session is already complete.")),
                ScaffoldSessionAppendResultKind.InvalidSubmission =>
                    TypedResults.BadRequest(Problem(
                        StatusCodes.Status400BadRequest,
                        "Submission is malformed or incompatible with the current step.")),
                ScaffoldSessionAppendResultKind.Appended =>
                    TypedResults.Ok(ScaffoldSessionResponseMapper.ToResponse(result.Context!)),
                _ => throw new InvalidOperationException(
                    "Unsupported scaffold session check service result.")
            };
        }

        static ProblemDetails Problem(int status, string title) => new()
        {
            Status = status,
            Title = title
        };
    }
}
