using AIInCSharp.WebApi.Agents;
using AIInCSharp.WebApi.Request;
using Microsoft.Agents.AI;
using System.Diagnostics;

using ApiAgentResponse =
    AIInCSharp.WebApi.Response.AgentResponse;

using AgentRunResult =
    Microsoft.Agents.AI.AgentResponse;

namespace AIInCSharp.WebApi.EndPoints;

public static class AgentEndpoints
{
    public static RouteGroupBuilder MapAgents(
        this RouteGroupBuilder group)
    {
        group.MapPost("/agent", RunAgentAsync)
            .WithName("RunAgent")
            .WithTags("Agent")
            .Produces<ApiAgentResponse>()
            .ProducesProblem(StatusCodes.Status400BadRequest);

        return group;
    }

    private static async Task<IResult> RunAgentAsync(
        AgentRequest request,
        AgentFactory agentFactory,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        ILogger logger = loggerFactory.CreateLogger(
            "AIInCSharp.WebApi.Agent");
        long startedAt = Stopwatch.GetTimestamp();

        logger.LogInformation(
            "Starting agent turn for model {Model} with {HistoryTurnCount} history turns",
            request.Model,
            request.History.Count);

        AgentCreation creation = agentFactory.Create(
            request.Model,
            request.Instructions);

        return creation switch
        {
            MyAgent created =>
                await ExecuteAgentAsync(
                    created.Agent,
                    request,
                    logger,
                    startedAt,
                    cancellationToken),

            AgentError error =>
                LogAndMapCreationError(
                    error,
                    request.Model,
                    logger,
                    startedAt)
        };
    }

    private static async Task<IResult> ExecuteAgentAsync(
        AIAgent agent,
        AgentRequest request,
        ILogger logger,
        long startedAt,
        CancellationToken cancellationToken)
    {
        var messages = request.ToChatMessages();

        try
        {
            AgentRunResult result = await agent.RunAsync(
                messages,
                cancellationToken: cancellationToken);

            var response = new ApiAgentResponse(
                Text: result.Text,
                Model: request.Model,
                InputTokens: ToTokenCount(
                    result.Usage?.InputTokenCount),
                OutputTokens: ToTokenCount(
                    result.Usage?.OutputTokenCount));

            logger.LogInformation(
                "Completed agent turn for model {Model} in {ElapsedMilliseconds} ms with {InputTokens} input tokens and {OutputTokens} output tokens",
                request.Model,
                Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds,
                response.InputTokens,
                response.OutputTokens);

            return TypedResults.Ok(response);
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            logger.LogInformation(
                "Agent turn for model {Model} was cancelled after {ElapsedMilliseconds} ms",
                request.Model,
                Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds);

            throw;
        }
        catch (Exception exception)
        {
            logger.LogError(
                exception,
                "Agent turn for model {Model} failed after {ElapsedMilliseconds} ms",
                request.Model,
                Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds);

            throw;
        }
    }

    private static int ToTokenCount(long? count) =>
        checked((int)(count ?? 0L));

    private static IResult LogAndMapCreationError(
        AgentError error,
        string model,
        ILogger logger,
        long startedAt)
    {
        logger.LogWarning(
            "Agent creation for model {Model} failed after {ElapsedMilliseconds} ms with {AgentError}",
            model,
            Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds,
            error);

        return MapCreationError(error);
    }

    private static IResult MapCreationError(
        AgentError error) =>
        error switch
        {
            UnknownModel unknown =>
                TypedResults.Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "Unknown model",
                    detail:
                        $"Model '{unknown.Model}' is not available."),

            MissingConfig missing =>
                TypedResults.Problem(
                    statusCode:
                        StatusCodes.Status500InternalServerError,
                    title: "Agent configuration is incomplete",
                    detail:
                        $"Configuration '{missing.Key}' is missing."),

            AuthFailed =>
                TypedResults.Problem(
                    statusCode: StatusCodes.Status502BadGateway,
                    title: "Provider authentication failed"),

            DeploymentNotFound deployment =>
                TypedResults.Problem(
                    statusCode: StatusCodes.Status502BadGateway,
                    title: "Foundry deployment was not found",
                    detail:
                        $"Deployment '{deployment.Deployment}' was not found."),

            RateLimited =>
                TypedResults.Problem(
                    statusCode: StatusCodes.Status429TooManyRequests,
                    title: "The model provider rate-limited the request"),

            Cancelled =>
                TypedResults.StatusCode(499)
        };
}
