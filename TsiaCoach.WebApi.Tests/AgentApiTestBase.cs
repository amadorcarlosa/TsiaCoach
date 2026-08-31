using TsiaCoach.WebApi.Agents;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace TsiaCoach.WebApi.Tests;

public abstract class AgentApiTestBase : ApiTestBase
{
    protected FakeAgentExecutor Executor { get; } = new();

    protected override void ConfigureTestServices(
        IServiceCollection services)
    {
        base.ConfigureTestServices(services);

        services.RemoveAll<IAgentExecutor>();

        services.AddSingleton<IAgentExecutor>(
            Executor);
    }
}