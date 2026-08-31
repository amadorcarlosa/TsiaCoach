using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

public sealed class ModelsEndpointTests : ApiTestBase
{
    [Test]
    public async Task Models_ReturnsConfiguredDeployments()
    {
        using HttpClient client = Factory.CreateClient();

        using HttpResponseMessage response =
            await client.GetAsync("/api/models");

        await Assert.That(response.StatusCode)
            .IsEqualTo(HttpStatusCode.OK);

        FoundryDeploymentResponse[]? models =
            await response.Content.ReadFromJsonAsync<
                FoundryDeploymentResponse[]>(JsonOptions);

        await Assert.That(models is not null).IsTrue();
        await Assert.That(models!.Length).IsEqualTo(6);

        await Assert.That(
                models.Any(model =>
                    model.Name == "DeepSeek-V4-Pro"))
            .IsTrue();
    }
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web)
        {
            Converters =
            {
                new JsonStringEnumConverter(
                    JsonNamingPolicy.CamelCase)
            }
        };
}
