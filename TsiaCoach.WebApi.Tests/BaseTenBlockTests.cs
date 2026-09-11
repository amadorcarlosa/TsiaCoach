using TsiaCoach.Domain.Manipulatives;

namespace TsiaCoach.WebApi.Tests;

public sealed class BaseTenBlockTests
{
    [Test]
    public async Task Catalog_CoversEveryDenominationAndPreservesUnitVolume()
    {
        await Assert.That(BaseTenBlockCatalog.All.Select(block => block.Denomination))
            .IsEquivalentTo(Enum.GetValues<Base10Denomination>());

        foreach (IBaseTenBlock block in BaseTenBlockCatalog.All)
        {
            Dimensions size = block.Dimensions;
            await Assert.That(size.Width * size.Depth * size.Height).IsEqualTo(block.Value);
        }
    }

    [Test]
    public async Task Union_AcceptsThousandBlock()
    {
        BaseTenBlocks block = new ThousandBlock();
        await Assert.That(block is ThousandBlock).IsTrue();
    }
}
