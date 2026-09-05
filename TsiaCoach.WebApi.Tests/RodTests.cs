using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.WebApi.Tests;

public sealed class RodTests
{
    [Test]
    public async Task Rod_IsOneToTenUnitsAndCarriesItsColour()
    {
        await Assert.That(Rod.All.Select(rod => rod.Units)).IsEquivalentTo(Enumerable.Range(1, 10));
        await Assert.That(Rod.White.Color).IsEqualTo(RodColor.White);
        await Assert.That(Rod.Red.Color).IsEqualTo(RodColor.Red);
        await Assert.That(Rod.Orange.Color).IsEqualTo(RodColor.Orange);
        await Assert.That(Rod.OfLength(2)).IsEqualTo(Rod.Red);
        await Assert.That(Rod.OfLength(2).Length).IsEqualTo(new UnitLength(2));
    }

    [Test]
    public async Task Rod_RejectsLengthsOutsideTheSet()
    {
        await Assert.That(() => Rod.OfLength(11)).Throws<ArgumentOutOfRangeException>();
        await Assert.That(() => Rod.OfLength(0)).Throws<ArgumentOutOfRangeException>();
        await Assert.That(Rod.TryOfLength(11, out _)).IsFalse();
        await Assert.That(Rod.TryOfLength(7, out Rod black)).IsTrue();
        await Assert.That(black).IsEqualTo(Rod.Black);
    }

    [Test]
    public async Task RodPlacement_KnowsItsFootprint()
    {
        RodPlacement red = RodPlacement.At(2, 3, 1);

        await Assert.That(red.Rod).IsEqualTo(Rod.Red);
        await Assert.That(red.Right).IsEqualTo(5);
        await Assert.That(red.Bottom).IsEqualTo(2);
        await Assert.That(red.Overlaps(RodPlacement.At(1, 4, 1))).IsTrue();
        await Assert.That(red.Overlaps(RodPlacement.At(1, 5, 1))).IsFalse();
        await Assert.That(red.Overlaps(RodPlacement.At(2, 3, 2))).IsFalse();
        await Assert.That(red.FitsWithin(cols: 5, rows: 2)).IsTrue();
        await Assert.That(red.FitsWithin(cols: 4, rows: 2)).IsFalse();
    }

    [Test]
    public async Task RodPlacement_StandsUprightWhenVertical()
    {
        RodPlacement upright = RodPlacement.At(3, 2, 1, RodOrientation.Vertical);

        await Assert.That((upright.Width, upright.Height, upright.Right, upright.Bottom))
            .IsEqualTo((1, 3, 3, 4));
        await Assert.That(upright.Overlaps(RodPlacement.At(2, 1, 3))).IsTrue();
        await Assert.That(upright.Overlaps(RodPlacement.At(2, 1, 4))).IsFalse();
        await Assert.That(upright.Overlaps(RodPlacement.At(2, 3, 2))).IsFalse();
        await Assert.That(upright.FitsWithin(cols: 3, rows: 4)).IsTrue();
        await Assert.That(upright.FitsWithin(cols: 3, rows: 3)).IsFalse();
        await Assert.That(RodPlacement.At(3, 2, 1).IsHorizontal).IsTrue();
    }

    [Test]
    public async Task RodTrain_ComposesAsManyStepRodsAsFitThenWhites()
    {
        RodTrain seven = RodTrain.Compose(new UnitLength(7), Rod.Red);
        RodTrain eight = RodTrain.Compose(new UnitLength(8), Rod.Red);
        RodTrain seven3 = RodTrain.Compose(new UnitLength(7), Rod.LightGreen);

        await Assert.That(seven.Rods).IsEquivalentTo([Rod.Red, Rod.Red, Rod.Red, Rod.White]);
        await Assert.That(eight.Rods).IsEquivalentTo([Rod.Red, Rod.Red, Rod.Red, Rod.Red]);
        await Assert.That(seven3.Rods).IsEquivalentTo([Rod.LightGreen, Rod.LightGreen, Rod.White]);
        await Assert.That(seven.TotalLength).IsEqualTo(7);
    }

    [Test]
    public async Task RodTrain_LaysOutEndToEndFromTheStartCell()
    {
        IReadOnlyList<RodPlacement> placements =
            RodTrain.Compose(new UnitLength(5), Rod.Red).LayOut(new GridCell(1, 5));

        await Assert.That(placements.Select(piece => (piece.Length, piece.X, piece.Y)))
            .IsEquivalentTo([(2, 1, 5), (2, 3, 5), (1, 5, 5)]);
    }

    [Test]
    public async Task RodTrain_LaysOutDownwardWhenVertical()
    {
        IReadOnlyList<RodPlacement> placements =
            RodTrain.Compose(new UnitLength(5), Rod.Red)
                .LayOut(new GridCell(4, 0), RodOrientation.Vertical);

        await Assert.That(placements.Select(piece => (piece.Length, piece.X, piece.Y, piece.Orientation)))
            .IsEquivalentTo(
            [
                (2, 4, 0, RodOrientation.Vertical),
                (2, 4, 2, RodOrientation.Vertical),
                (1, 4, 4, RodOrientation.Vertical)
            ]);
        await Assert.That(placements.All(piece => piece.Width == 1)).IsTrue();
    }

    [Test]
    public async Task GridPiece_SharesOneFootprintAcrossRodsAndTiles()
    {
        GridPiece rod = RodPlacement.At(3, 1, 1);
        GridPiece variable = new VariableTile(new SymbolName("n"), DrawnLength: 4, new GridCell(4, 1));
        GridPiece constant = new ConstantTile(new GridCell(8, 1));

        await Assert.That(rod.Kind).IsEqualTo(PieceKind.Rod);
        await Assert.That(variable.Kind).IsEqualTo(PieceKind.Variable);
        await Assert.That(constant.Kind).IsEqualTo(PieceKind.Constant);
        await Assert.That((rod.Length, rod.Right, rod.Symbol)).IsEqualTo((3, 4, (string?)null));
        await Assert.That((variable.Length, variable.Right, variable.Symbol)).IsEqualTo((4, 8, (string?)"n"));
        await Assert.That((constant.Length, constant.Right)).IsEqualTo((1, 9));
        await Assert.That(rod.Overlaps(variable)).IsFalse();
        await Assert.That(variable.Overlaps(constant)).IsFalse();
        await Assert.That(rod.Overlaps(RodPlacement.At(2, 2, 1))).IsTrue();

        GridPiece upright = RodPlacement.At(3, 5, 0, RodOrientation.Vertical);
        await Assert.That((upright.Orientation, upright.Width, upright.Height, upright.Bottom))
            .IsEqualTo((RodOrientation.Vertical, 1, 3, 3));
        await Assert.That(upright.Overlaps(variable)).IsTrue();
        await Assert.That(upright.Overlaps(constant)).IsFalse();
    }
}
