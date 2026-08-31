using System.Net;

namespace TsiaCoach.WebApi.Tests;

public sealed class HealthEndpointTests : ApiTestBase
{
    [Test]
    public async Task Health_ReturnsOk()
    {
        using HttpClient client = Factory.CreateClient();

        using HttpResponseMessage response =
            await client.GetAsync("/health");

        await Assert.That(response.StatusCode)
            .IsEqualTo(HttpStatusCode.OK);
    }
}