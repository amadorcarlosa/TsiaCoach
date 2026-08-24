namespace AIInCSharp.WebApi.Response;

public sealed record AgentResponse(
    string Text, string Model, int InputTokens, int OutputTokens);