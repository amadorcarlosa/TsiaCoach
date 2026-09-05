using System.Collections.ObjectModel;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Scaffolds;

/// <summary>The ten Cuisenaire colours, numbered by the length each one stands for.</summary>
public enum RodColor
{
    White = 1,
    Red = 2,
    LightGreen = 3,
    Purple = 4,
    Yellow = 5,
    DarkGreen = 6,
    Black = 7,
    Brown = 8,
    Blue = 9,
    Orange = 10
}

/// <summary>
/// A Cuisenaire rod: a whole-unit length from 1 to 10, and the colour that
/// length carries. A rod has no identity beyond its length; every red is the
/// same rod, which is why this is a value type. Where a rod lies is a
/// <see cref="RodPlacement"/>; rods end to end are a <see cref="RodTrain"/>;
/// an authored rod whose length may be resolved from the practice item is a
/// <see cref="RodResource"/>.
/// </summary>
public readonly record struct Rod
{
    public const int MinUnits = 1;
    public const int MaxUnits = 10;

    public Rod(UnitLength length)
    {
        if (!IsRodLength(length.Value))
        {
            throw new ArgumentOutOfRangeException(
                nameof(length),
                length.Value,
                $"A rod is {MinUnits} to {MaxUnits} units long.");
        }

        Length = length;
    }

    public UnitLength Length { get; }

    public int Units => Length.Value;

    public RodColor Color => (RodColor)Units;

    public static Rod OfLength(int units) => new(new UnitLength(units));

    public static bool IsRodLength(int units) =>
        units is >= MinUnits and <= MaxUnits;

    public static bool TryOfLength(int units, out Rod rod)
    {
        if (IsRodLength(units))
        {
            rod = OfLength(units);
            return true;
        }

        rod = default;
        return false;
    }

    public static readonly Rod White = OfLength(1);
    public static readonly Rod Red = OfLength(2);
    public static readonly Rod LightGreen = OfLength(3);
    public static readonly Rod Purple = OfLength(4);
    public static readonly Rod Yellow = OfLength(5);
    public static readonly Rod DarkGreen = OfLength(6);
    public static readonly Rod Black = OfLength(7);
    public static readonly Rod Brown = OfLength(8);
    public static readonly Rod Blue = OfLength(9);
    public static readonly Rod Orange = OfLength(10);

    /// <summary>The staircase: every rod from white to orange, by length.</summary>
    public static readonly IReadOnlyList<Rod> All =
        Enumerable.Range(MinUnits, MaxUnits).Select(OfLength).ToArray();

    public override string ToString() => $"{Color} {Units}";
}

/// <summary>A cell on the grid: column <see cref="X"/>, row <see cref="Y"/>. y grows downward.</summary>
public readonly record struct GridCell(int X, int Y);

/// <summary>Which way a rod lies on the grid. A vertical rod stands on its origin cell and grows downward.</summary>
public enum RodOrientation
{
    Horizontal,
    Vertical
}

/// <summary>
/// A rod lying on the grid: its origin is the top-left cell it covers, and it
/// extends <see cref="Length"/> cells to the right when horizontal or
/// downward when vertical. An authored reference rod and a rod the learner
/// drops are the same object; the scene decides which role it plays.
/// </summary>
public sealed record RodPlacement(
    Rod Rod,
    GridCell Origin,
    RodOrientation Orientation = RodOrientation.Horizontal
)
{
    public static RodPlacement At(
        int length,
        int x,
        int y,
        RodOrientation orientation = RodOrientation.Horizontal) =>
        new(Rod.OfLength(length), new GridCell(x, y), orientation);

    public int X => Origin.X;

    public int Y => Origin.Y;

    public int Length => Rod.Units;

    public bool IsHorizontal => Orientation == RodOrientation.Horizontal;

    /// <summary>Cells covered left to right.</summary>
    public int Width => IsHorizontal ? Length : 1;

    /// <summary>Cells covered top to bottom.</summary>
    public int Height => IsHorizontal ? 1 : Length;

    /// <summary>The first column after the rod.</summary>
    public int Right => X + Width;

    /// <summary>The first row after the rod.</summary>
    public int Bottom => Y + Height;

    public bool Overlaps(RodPlacement other) =>
        X < other.Right && other.X < Right &&
        Y < other.Bottom && other.Y < Bottom;

    public bool FitsWithin(int cols, int rows) =>
        X >= 0 && Y >= 0 && Right <= cols && Bottom <= rows;
}

/// <summary>
/// Rods laid end to end on one row: what the playground calls a track and
/// the parity ladder calls a composition. <see cref="TotalLength"/> is the
/// span the train measures.
/// </summary>
public sealed record RodTrain
{
    public RodTrain(IReadOnlyList<Rod> rods)
    {
        Rods = new ReadOnlyCollection<Rod>(rods.ToArray());
    }

    public IReadOnlyList<Rod> Rods { get; }

    public int TotalLength => Rods.Sum(rod => rod.Units);

    /// <summary>
    /// As many <paramref name="step"/> rods as fit in <paramref name="span"/>,
    /// then whites for whatever is left: the rule the rebuild step enforces.
    /// </summary>
    public static RodTrain Compose(UnitLength span, Rod step)
    {
        (int stepRods, int whites) = RodFit.Measure(step.Length, span).Value switch
        {
            FlushFit flush => (flush.CompleteRods.Value, 0),
            RemainderFit remainder => (remainder.CompleteRods.Value, remainder.Remainder.Value),
            _ => throw new InvalidOperationException("Unsupported fit outcome.")
        };

        return new RodTrain(
        [
            .. Enumerable.Repeat(step, stepRods),
            .. Enumerable.Repeat(Rod.White, whites)
        ]);
    }

    /// <summary>
    /// The train placed on the grid, first rod starting at <paramref name="start"/>,
    /// running right when horizontal or down when vertical.
    /// </summary>
    public IReadOnlyList<RodPlacement> LayOut(
        GridCell start,
        RodOrientation orientation = RodOrientation.Horizontal)
    {
        var placements = new List<RodPlacement>(Rods.Count);
        GridCell cursor = start;

        foreach (Rod rod in Rods)
        {
            placements.Add(new RodPlacement(rod, cursor, orientation));
            cursor = orientation == RodOrientation.Horizontal
                ? cursor with { X = cursor.X + rod.Units }
                : cursor with { Y = cursor.Y + rod.Units };
        }

        return placements;
    }
}
