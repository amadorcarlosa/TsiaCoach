using System.Text.Json.Nodes;

namespace TsiaCoach.WebApi.Tests;

public sealed class RodCatalogEndpointTests : ApiTestBase
{
    [Test]
    public async Task Catalog_SerializesDomainRatiosForAllThreePoses()
    {
        using var client = Factory.CreateClient();
        var catalog = JsonNode.Parse(await client.GetStringAsync("/api/rods"))!.AsArray();
        await Assert.That(catalog.Count).IsEqualTo(10);
        var orange = catalog.Single(rod => rod!["length"]!.GetValue<int>() == 10)!;
        var tower = orange["poses"]!.AsArray().Single(pose => pose!["orientation"]!.GetValue<string>() == "tower")!;
        await Assert.That(tower["dimensions"]!["width"]!.GetValue<int>()).IsEqualTo(1);
        await Assert.That(tower["dimensions"]!["depth"]!.GetValue<int>()).IsEqualTo(1);
        await Assert.That(tower["dimensions"]!["height"]!.GetValue<int>()).IsEqualTo(10);
    }
}
