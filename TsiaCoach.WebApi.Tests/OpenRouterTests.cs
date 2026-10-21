using System.ClientModel;
using System.ClientModel.Primitives;
using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using OpenAI;
using TsiaCoach.WebApi.Agents;
using TsiaCoach.WebApi.CoachingAgents;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

public sealed class OpenRouterTests
{
    private const string Model = "openai/test-model";

    [Test]
    public async Task OpenRouter_RegistersWithoutAzure_AndDefaultsCoachToFirstModel()
    {
        var configuration = Configuration();
        var services = new ServiceCollection();
        services.AddAgentProvider(configuration);
        services.AddOptions<CoachingAgentOptions>().Bind(configuration.GetSection("CoachingAgent"));
        using var provider = services.BuildServiceProvider();

        var factory = provider.GetRequiredService<AgentFactory>();
        await Assert.That(factory.AvailableModels.Single().Name).IsEqualTo(Model);
        await Assert.That(factory.AvailableModels.Single().Vendor).IsEqualTo(VendorName.OpenRouter);
        await Assert.That(provider.GetService<ModelClient>() is null).IsTrue();
        await Assert.That(provider.GetRequiredService<IOptions<CoachingAgentOptions>>().Value.Model).IsEqualTo(Model);
        await Assert.That(factory.Create("unlisted/model", "Coach").Value is AgentError).IsTrue();
    }

    [Test]
    [Arguments("OpenRouter:ApiKey", "")]
    [Arguments("OpenRouter:Models:0", "typesafe/jev-1.13")]
    [Arguments("CoachingAgent:Model", "unlisted/model")]
    [Arguments("AgentProvider", "typo")]
    public async Task InvalidConfiguration_FailsEarly(string key, string value)
    {
        var configuration = Configuration();
        configuration[key] = value;
        await Assert.That(() => new ServiceCollection().AddAgentProvider(configuration))
            .Throws<InvalidOperationException>();
    }

    [Test]
    public async Task Agent_SendsChatCompletion_WithHistoryInstructionsAndJsonFormat()
    {
        using var handler = new CapturingHandler(HttpStatusCode.OK, """
            {"id":"test","object":"chat.completion","created":1,"model":"openai/test-model",
             "choices":[{"index":0,"message":{"role":"assistant","content":"{\"move\":\"routeToStep\",\"shapeId\":\"structural\"}"},"finish_reason":"stop"}],
             "usage":{"prompt_tokens":20,"completion_tokens":10,"total_tokens":30}}
            """);
        using var http = new HttpClient(handler);
        var factory = Factory(http);
        var creation = factory.Create(Model, "Classify the student answer. Return JSON.");
        var agent = (MyAgent)creation.Value;
        var executor = new AgentExecutor(Configuration());
        var result = await executor.RunAsync(agent.Agent, Model,
            [new(ChatRole.User, "Earlier question"), new(ChatRole.Assistant, "Earlier reply"),
             new(ChatRole.User, "one left over after pairing")], CancellationToken.None, ChatResponseFormat.Json);

        await Assert.That(result.Value is Reply).IsTrue();
        var reply = (Reply)result.Value;
        await Assert.That(reply.InputTokens).IsEqualTo(20L);
        await Assert.That(reply.OutputTokens).IsEqualTo(10L);
        await Assert.That(reply.Text).IsEqualTo("""{"move":"routeToStep","shapeId":"structural"}""");
        await Assert.That(handler.Uri).IsEqualTo("https://openrouter.ai/api/v1/chat/completions");
        await Assert.That(handler.Authorization).IsEqualTo("Bearer test-key");
        using var body = JsonDocument.Parse(handler.Body!);
        await Assert.That(body.RootElement.GetProperty("model").GetString()).IsEqualTo(Model);
        await Assert.That(body.RootElement.GetProperty("response_format").GetProperty("type").GetString()).IsEqualTo("json_object");
        var messages = body.RootElement.GetProperty("messages").EnumerateArray().ToArray();
        await Assert.That(messages.Length).IsEqualTo(4);
        await Assert.That(messages[0].GetProperty("content").GetString()).IsEqualTo("Classify the student answer. Return JSON.");
        await Assert.That(messages[2].GetProperty("role").GetString()).IsEqualTo("assistant");
    }

    [Test]
    [Arguments(401)]
    [Arguments(404)]
    [Arguments(429)]
    [Arguments(502)]
    public async Task ProviderErrors_AreMapped(int status)
    {
        using var handler = new CapturingHandler((HttpStatusCode)status,
            """{"error":{"message":"provider error","type":"api_error","code":"test"}}""");
        using var http = new HttpClient(handler);
        var agent = (MyAgent)Factory(http).Create(Model, "Coach").Value!;
        var result = await new AgentExecutor(Configuration()).RunAsync(agent.Agent, Model,
            [new(ChatRole.User, "hello")], CancellationToken.None);
        var error = (AgentError)result.Value!;
        bool expected = status switch
        {
            401 => error.Value is AuthFailed,
            404 => error.Value is DeploymentNotFound,
            429 => error.Value is RateLimited,
            _ => error.Value is ProviderRejected
        };
        await Assert.That(expected).IsTrue();
    }

    private static AgentFactory Factory(HttpClient http) => new(
        new OpenAIClient(new ApiKeyCredential("test-key"), new OpenAIClientOptions
        {
            Endpoint = new Uri(AgentProviderRegistration.OpenRouterEndpoint),
            Transport = new HttpClientPipelineTransport(http),
            RetryPolicy = new ClientRetryPolicy(0)
        }),
        [new FoundryDeploymentResponse(Model, Model, VendorName.OpenRouter)]);

    private static IConfigurationRoot Configuration() => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AgentProvider"] = "OpenRouter",
            ["OpenRouter:ApiKey"] = "test-key",
            ["OpenRouter:Models:0"] = Model
        }).Build();

    private sealed class CapturingHandler(HttpStatusCode status, string response) : HttpMessageHandler
    {
        public string? Uri { get; private set; }
        public string? Authorization { get; private set; }
        public string? Body { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            Uri = request.RequestUri!.ToString();
            Authorization = request.Headers.Authorization?.ToString();
            Body = await request.Content!.ReadAsStringAsync(token);
            return new HttpResponseMessage(status)
            {
                Content = new StringContent(response, Encoding.UTF8, "application/json")
            };
        }
    }
}
