using TsiaCoach.WebApi.Agents;
using TsiaCoach.WebApi.Request;
using Microsoft.Agents.AI;
using System.Diagnostics;

using ApiAgentResponse =
    TsiaCoach.WebApi.Response.AgentResponse;


namespace TsiaCoach.WebApi.EndPoints;

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
        IAgentExecutor agentExecutor,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        ILogger logger = loggerFactory.CreateLogger(
            "TsiaCoach.WebApi.Agent");
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
                    agentExecutor,
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
        IAgentExecutor agentExecutor,
        ILogger logger,
        long startedAt,
        CancellationToken cancellationToken)
    {
        var messages = request.ToChatMessages();

        try
        {
            AgentReply outcome =
                await agentExecutor.RunAsync(
                    agent,
                    request.Model,
                    messages,
                    cancellationToken);

            return outcome switch
            {
                Reply reply =>
                    LogAndMapReply(
                        reply,
                        request.Model,
                        logger,
                        startedAt),

                AgentError error =>
                    LogAndMapExecutionError(
                        error,
                        request.Model,
                        logger,
                        startedAt)
            };
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            logger.LogInformation(
                "Agent turn for model {Model} was cancelled after {ElapsedMilliseconds} ms",
                request.Model,
                Stopwatch.GetElapsedTime(startedAt)
                    .TotalMilliseconds);

            throw;
        }
        catch (Exception exception)
        {
            logger.LogError(
                exception,
                "Agent turn for model {Model} failed after {ElapsedMilliseconds} ms",
                request.Model,
                Stopwatch.GetElapsedTime(startedAt)
                    .TotalMilliseconds);

            throw;
        }
    }
    private static IResult LogAndMapReply(
        Reply reply,
        string model,
        ILogger logger,
        long startedAt)
    {
        var response = new ApiAgentResponse(
            Text: reply.Text,
            Model: model,
            InputTokens: ToTokenCount(reply.InputTokens),
            OutputTokens: ToTokenCount(reply.OutputTokens));

        logger.LogInformation(
            "Completed agent turn for model {Model} in {ElapsedMilliseconds} ms with {InputTokens} input tokens and {OutputTokens} output tokens",
            model,
            Stopwatch.GetElapsedTime(startedAt)
                .TotalMilliseconds,
            response.InputTokens,
            response.OutputTokens);

        return TypedResults.Ok(response);
    }

    private static IResult LogAndMapExecutionError(
        AgentError error,
        string model,
        ILogger logger,
        long startedAt)
    {
        logger.LogWarning(
            "Agent turn for model {Model} ended after {ElapsedMilliseconds} ms with {AgentError}",
            model,
            Stopwatch.GetElapsedTime(startedAt)
                .TotalMilliseconds,
            error);

        return MapAgentError(error);
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

        return MapAgentError(error);
    }

    private static IResult MapAgentError(
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
                TypedResults.StatusCode(499),

            ProviderRejected rejected =>
                TypedResults.Problem(
                    statusCode: StatusCodes.Status502BadGateway,
                    title: "The model provider rejected the request",
                    detail:
                        $"Provider returned HTTP {rejected.Status}.")
        };
}
