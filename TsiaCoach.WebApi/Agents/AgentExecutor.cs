namespace TsiaCoach.WebApi.Agents;

using Anthropic.Exceptions;
using Azure;
using Azure.Identity;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Configuration;
using System.ClientModel;

using FrameworkAgentResponse =
    Microsoft.Agents.AI.AgentResponse;


public sealed class AgentExecutor : IAgentExecutor
{
    private readonly string _openAiEndpoint;
    private readonly string _foundryResource;

    public AgentExecutor(IConfiguration configuration)
    {
        _openAiEndpoint =
            configuration["endpoint"] ?? string.Empty;

        _foundryResource =
            configuration["foundryResource"] ?? string.Empty;
    }

    public async Task<AgentReply> RunAsync(
        AIAgent agent,
        string model,
        IReadOnlyList<ChatMessage> messages,
        CancellationToken cancellationToken)
    {
        try
        {
            FrameworkAgentResponse result =
                await agent.RunAsync(
                    messages,
                    cancellationToken: cancellationToken);

            return new AgentReply(
                new Reply(
                    result.Text,
                    result.Usage?.InputTokenCount,
                    result.Usage?.OutputTokenCount));
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            return CancelledReply();
        }
        catch (AnthropicRateLimitException)
        {
            return RateLimitedReply();
        }
        catch (RequestFailedException exception)
            when (exception.Status == 429)
        {
            return RateLimitedReply();
        }
        catch (ClientResultException exception)
            when (exception.Status == 429)
        {
            return RateLimitedReply();
        }
        catch (AnthropicUnauthorizedException exception)
        {
            return AuthFailedReply(exception);
        }
        catch (AnthropicForbiddenException exception)
        {
            return AuthFailedReply(exception);
        }
        catch (AuthenticationFailedException exception)
        {
            return AuthFailedReply(exception);
        }
        catch (RequestFailedException exception)
            when (exception.Status is 401 or 403)
        {
            return AuthFailedReply(exception);
        }
        catch (ClientResultException exception)
            when (exception.Status is 401 or 403)
        {
            return AuthFailedReply(exception);
        }
        catch (AnthropicNotFoundException)
        {
            return DeploymentNotFoundReply(
                model,
                _foundryResource);
        }
        catch (RequestFailedException exception)
            when (exception.Status == 404)
        {
            return DeploymentNotFoundReply(
                model,
                _openAiEndpoint);
        }
        catch (ClientResultException exception)
            when (exception.Status == 404)
        {
            return DeploymentNotFoundReply(
                model,
                _openAiEndpoint);
        }
    }

    private static AgentReply CancelledReply() =>
        new(
            new AgentError(
                new Cancelled()));

    private static AgentReply RateLimitedReply() =>
        new(
            new AgentError(
                new RateLimited(RetryAfter: null)));

    private static AgentReply AuthFailedReply(
        Exception exception) =>
        new(
            new AgentError(
                new AuthFailed(exception.Message)));

    private static AgentReply DeploymentNotFoundReply(
        string model,
        string endpoint) =>
        new(
            new AgentError(
                new DeploymentNotFound(model, endpoint)));
}