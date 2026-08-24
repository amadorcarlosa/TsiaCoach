using AIInCSharp.WebApi.Request;
using AIInCSharp.WebApi.Response;

namespace AIInCSharp.WebApi.EndPoints;

public static class AgentEndpoints
{
    public static RouteGroupBuilder MapAgents(this RouteGroupBuilder group)
    {
        group.MapPost("/agent", (AgentRequest request) =>
                TypedResults.Ok(new AgentResponse(
                    $"(echo from .NET) {request.Prompt}",
                    request.Model,
                    InputTokens: 0,
                    OutputTokens: 0)))
            .WithName("RunAgent")
            .WithTags("Agent");

        return group;
    }
}