namespace TsiaCoach.AppHost.Tests;

using System.Net;
using System.Text.Json;



[Explicit]
[Category("Aspire")]
[ClassDataSource<AppFixture>(
    Shared = SharedType.PerTestSession)]
public sealed class AspireApiTests(
    AppFixture fixture)
{
    [Test]
    public async Task HealthEndpoint_ReturnsOk()
    {
        using HttpClient client =
            fixture.CreateHttpClient(
                resourceName: "api",
                endpointName: "http");

        using var timeout =
            new CancellationTokenSource(
                TimeSpan.FromSeconds(30));

        using HttpResponseMessage response =
            await client.GetAsync(
                "/health",
                timeout.Token);

        await Assert.That(response.StatusCode)
            .IsEqualTo(HttpStatusCode.OK);
    }

    [Test]
    public async Task ModelsEndpoint_ReturnsCatalog()
    {
        using HttpClient client =
            fixture.CreateHttpClient(
                resourceName: "api",
                endpointName: "http");

        using var timeout =
            new CancellationTokenSource(
                TimeSpan.FromSeconds(30));

        using HttpResponseMessage response =
            await client.GetAsync(
                "/api/models",
                timeout.Token);

        await Assert.That(response.StatusCode)
            .IsEqualTo(HttpStatusCode.OK);

        string json =
            await response.Content
                .ReadAsStringAsync(timeout.Token);

        using JsonDocument document =
            JsonDocument.Parse(json);

        await Assert.That(
                document.RootElement.GetArrayLength())
            .IsEqualTo(6);
    }
}