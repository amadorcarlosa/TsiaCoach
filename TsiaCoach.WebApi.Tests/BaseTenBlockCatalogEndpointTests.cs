using System.Text.Json.Nodes;

namespace TsiaCoach.WebApi.Tests;

public sealed class BaseTenBlockCatalogEndpointTests : ApiTestBase
{
    [Test]
    public async Task Catalog_SerializesAllDenominationsWithShapesAndDimensions()
    {
        using var client = Factory.CreateClient();
        var catalog = JsonNode.Parse(await client.GetStringAsync("/api/base-ten-blocks"))!.AsArray();
        await Assert.That(catalog.Count).IsEqualTo(7);
        await Assert.That(catalog.Select(block => block!["denomination"]!.GetValue<string>()))
            .IsEquivalentTo(new[] { "ones", "tens", "hundreds", "thousands", "tenThousands", "hundredThousands", "millions" });
        await Assert.That(catalog.Select(block => block!["shape"]!.GetValue<string>()))
            .IsEquivalentTo(new[] { "cube", "long", "flat", "cube", "long", "flat", "cube" });
        foreach (var block in catalog)
        {
            var size = block!["dimensions"]!;
            int volume = size["width"]!.GetValue<int>() * size["depth"]!.GetValue<int>() * size["height"]!.GetValue<int>();
            await Assert.That(volume).IsEqualTo(block["value"]!.GetValue<int>());
        }
    }
}
