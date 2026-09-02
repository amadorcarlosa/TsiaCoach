using Microsoft.Agents.AI;

namespace TsiaCoach.WebApi.Agents;
public sealed record MissingConfig(string Key);
public sealed record AuthFailed(string Detail);
public sealed record DeploymentNotFound(string Deployment, string Endpoint);
public sealed record RateLimited(TimeSpan? RetryAfter);
public sealed record Cancelled;
public sealed record ProviderRejected(int Status, string Detail);

public sealed record UnknownModel(string Model);

public union AgentError(
    MissingConfig, 
    AuthFailed, 
    DeploymentNotFound, 
    RateLimited, 
    Cancelled,
    UnknownModel,
    ProviderRejected);


public sealed record MyAgent(AIAgent Agent);

public sealed record Reply(
    string Text,
    long? InputTokens,
    long? OutputTokens);

public union AgentCreation(MyAgent, AgentError);
public union ClientCreation(ModelClient, AgentError);




public union AgentReply(Reply, AgentError);