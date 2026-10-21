using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using TsiaCoach.WebApi.Agents;

namespace TsiaCoach.WebApi.Tests;

public sealed class JevDecisionTests
{
    [Test]
    public async Task SendsDecisionsRequestAndPreservesProbabilities()
    {
        using var handler = new Handler("""
        {"model":"typesafe/jev-1.13","answers":{"intervention":{"type":"choice","choice":"hint","confidence":0.9,"probabilities":{"observe":0.02,"ask":0.06,"hint":0.9,"demonstrate":0.02}}},"usage":{"cost":0.00001}}
        """);
        using var http = new HttpClient(handler);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["OpenRouter:ApiKey"] = "test-key" }).Build();
        var client = new JevDecisionClient(http, config);
        var result = await client.DecideAsync(new(JsonSerializer.SerializeToElement(new { task = "Pair rods" }), "Choose an intervention"), CancellationToken.None);
        await Assert.That(result.Action).IsEqualTo("hint");
        await Assert.That(result.Confidence).IsEqualTo(0.9);
        await Assert.That(result.Probabilities!["hint"]).IsEqualTo(0.9);
        await Assert.That(handler.Url).IsEqualTo("https://openrouter.ai/api/alpha/decisions");
        await Assert.That(handler.Auth).IsEqualTo("Bearer test-key");
        using var body = JsonDocument.Parse(handler.Body!);
        await Assert.That(body.RootElement.GetProperty("questions").GetProperty("intervention").GetProperty("criteria").EnumerateObject().Count()).IsEqualTo(4);
        await Assert.That(body.RootElement.TryGetProperty("messages", out _)).IsFalse();
    }

    [Test]
    [Arguments("delete", 0.9)]
    [Arguments("hint", 1.5)]
    public async Task RejectsInvalidProviderValues(string action, double confidence)
    {
        using var handler = new Handler(JsonSerializer.Serialize(new { answers = new { intervention = new { type = "choice", choice = action, confidence } } }));
        using var http = new HttpClient(handler);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["OpenRouter:ApiKey"] = "test" }).Build();
        await Assert.That(async () => await new JevDecisionClient(http, config).DecideAsync(
            new(JsonSerializer.SerializeToElement(new { task = "test" }), "test"), CancellationToken.None)).Throws<JsonException>();
    }

    private sealed class Handler(string response) : HttpMessageHandler
    {
        public string? Url, Auth, Body;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            Url = request.RequestUri!.ToString();
            Auth = request.Headers.Authorization?.ToString();
            Body = await request.Content!.ReadAsStringAsync(token);
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(response, Encoding.UTF8, "application/json") };
        }
    }
}
