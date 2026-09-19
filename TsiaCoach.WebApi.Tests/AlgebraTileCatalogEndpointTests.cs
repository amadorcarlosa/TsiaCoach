using System.Text.Json.Nodes;

namespace TsiaCoach.WebApi.Tests;

public sealed class AlgebraTileCatalogEndpointTests : ApiTestBase
{
    [Test]
    public async Task Catalog_SerializesEverySignedTermWithShapeAndSymbolicDimensions()
    {
        using var client = Factory.CreateClient();
        var catalog = JsonNode.Parse(await client.GetStringAsync("/api/algebra-tiles"))!.AsArray();
        await Assert.That(catalog.Count).IsEqualTo(12);

        var expected = new (string Term, string Shape, string Width, string Height)[]
        {
            ("one", "square", "one", "one"),
            ("x", "rectangle", "x", "one"),
            ("y", "rectangle", "y", "one"),
            ("xSquared", "square", "x", "x"),
            ("ySquared", "square", "y", "y"),
            ("xy", "rectangle", "x", "y")
        };

        foreach (var (term, shape, width, height) in expected)
        foreach (var (sign, coefficient) in new[] { ("positive", 1), ("negative", -1) })
        {
            var tile = catalog.Single(tile =>
                tile!["term"]!.GetValue<string>() == term &&
                tile["sign"]!.GetValue<string>() == sign)!;
            await Assert.That(tile["coefficient"]!.GetValue<int>()).IsEqualTo(coefficient);
            await Assert.That(tile["shape"]!.GetValue<string>()).IsEqualTo(shape);
            await Assert.That(tile["dimensions"]!["width"]!.GetValue<string>()).IsEqualTo(width);
            await Assert.That(tile["dimensions"]!["height"]!.GetValue<string>()).IsEqualTo(height);
        }
    }
}
