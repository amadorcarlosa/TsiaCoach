using TsiaCoach.Domain.Manipulatives;

namespace TsiaCoach.WebApi.Tests;

public sealed class AlgebraTileTests
{
    [Test]
    public async Task Catalog_ContainsTwelveDistinctTilesAndEveryOpposite()
    {
        await Assert.That(AlgebraTileCatalog.All.Count).IsEqualTo(12);
        await Assert.That(AlgebraTileCatalog.All.Distinct().Count()).IsEqualTo(12);

        foreach (IAlgebraTile tile in AlgebraTileCatalog.All)
        {
            await Assert.That(AlgebraTileCatalog.All.Contains(tile.Opposite())).IsTrue();
            await Assert.That(tile.Opposite().Opposite()).IsEqualTo(tile);
            await Assert.That(tile.Coefficient + tile.Opposite().Coefficient).IsEqualTo(0);
            await Assert.That(tile.Dimensions).IsEqualTo(tile.Opposite().Dimensions);
        }
    }

    [Test]
    public async Task Dimensions_PreserveSymbolicSides()
    {
        var expected = new (AlgebraTileTerm Term, AlgebraTileSide Width, AlgebraTileSide Height)[]
        {
            (AlgebraTileTerm.One, AlgebraTileSide.One, AlgebraTileSide.One),
            (AlgebraTileTerm.X, AlgebraTileSide.X, AlgebraTileSide.One),
            (AlgebraTileTerm.Y, AlgebraTileSide.Y, AlgebraTileSide.One),
            (AlgebraTileTerm.XSquared, AlgebraTileSide.X, AlgebraTileSide.X),
            (AlgebraTileTerm.YSquared, AlgebraTileSide.Y, AlgebraTileSide.Y),
            (AlgebraTileTerm.XY, AlgebraTileSide.X, AlgebraTileSide.Y)
        };

        foreach (var (term, width, height) in expected)
            await Assert.That(AlgebraTileCatalog.All.Single(tile => tile.Term == term && tile.Sign == AlgebraTileSign.Positive).Dimensions)
                .IsEqualTo(new AlgebraTileDimensions(width, height));
    }

    [Test]
    public async Task ZeroPairs_RequireMatchingTermsAndOppositeSigns()
    {
        foreach (IAlgebraTile tile in AlgebraTileCatalog.All)
        foreach (IAlgebraTile other in AlgebraTileCatalog.All)
        {
            bool expected = tile.Term == other.Term && tile.Coefficient + other.Coefficient == 0;
            await Assert.That(tile.FormsZeroPairWith(other)).IsEqualTo(expected);
        }
    }

    [Test]
    public async Task Constructors_RejectInvalidSigns()
    {
        Func<AlgebraTileSign, IAlgebraTile>[] constructors =
        [
            sign => new OneTile(sign), sign => new XTile(sign), sign => new YTile(sign),
            sign => new XSquaredTile(sign), sign => new YSquaredTile(sign), sign => new XYTile(sign)
        ];
        foreach (var create in constructors)
        foreach (int invalid in new[] { -2, 0, 2 })
            await Assert.That(() => create((AlgebraTileSign)invalid))
                .Throws<ArgumentOutOfRangeException>();
    }

    [Test]
    public async Task Union_AcceptsAllSixConcreteTileTypesAndPreservesSign()
    {
        AlgebraTiles[] tiles =
        [
            new OneTile(), new XTile(), new YTile(),
            new XSquaredTile(), new YSquaredTile(), new XYTile(AlgebraTileSign.Negative)
        ];
        await Assert.That(tiles[0] is OneTile).IsTrue();
        await Assert.That(tiles[1] is XTile).IsTrue();
        await Assert.That(tiles[2] is YTile).IsTrue();
        await Assert.That(tiles[3] is XSquaredTile).IsTrue();
        await Assert.That(tiles[4] is YSquaredTile).IsTrue();
        await Assert.That(tiles[5] is XYTile { Sign: AlgebraTileSign.Negative }).IsTrue();
    }
}
