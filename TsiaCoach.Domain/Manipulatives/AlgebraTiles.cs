namespace TsiaCoach.Domain.Manipulatives;

public enum AlgebraTileTerm
{
    One,
    X,
    Y,
    XSquared,
    YSquared,
    XY
}

public enum AlgebraTileSign
{
    Negative = -1,
    Positive = 1
}

/// <summary>A symbolic side length, independent of the size used to draw a tile.</summary>
public enum AlgebraTileSide
{
    One,
    X,
    Y
}

/// <summary>Canonical face dimensions. A negative tile has the same geometry as its positive counterpart.</summary>
public readonly record struct AlgebraTileDimensions(AlgebraTileSide Width, AlgebraTileSide Height);

public interface IAlgebraTileShape
{
    AlgebraTileDimensions GetDimensions();
}

public sealed record SquareTileShape(AlgebraTileSide Edge) : IAlgebraTileShape
{
    public AlgebraTileDimensions GetDimensions() => new(Edge, Edge);
}

public sealed record RectangleTileShape(AlgebraTileSide Width, AlgebraTileSide Height) : IAlgebraTileShape
{
    public AlgebraTileDimensions GetDimensions() => new(Width, Height);
}

/// <summary>A signed symbolic term. Placement and drawing scale belong to the scene.</summary>
public interface IAlgebraTile
{
    AlgebraTileTerm Term { get; }
    AlgebraTileSign Sign { get; }
    IAlgebraTileShape Shape { get; }
    int Coefficient => (int)Sign;
    AlgebraTileDimensions Dimensions => Shape.GetDimensions();
    IAlgebraTile Opposite();
    bool FormsZeroPairWith(IAlgebraTile other) => Term == other.Term && Sign != other.Sign;
}

public sealed record OneTile : IAlgebraTile
{
    public OneTile(AlgebraTileSign sign = AlgebraTileSign.Positive)
    {
        if (!Enum.IsDefined(sign))
            throw new ArgumentOutOfRangeException(nameof(sign), sign, "An algebra tile must be positive or negative.");
        Sign = sign;
    }

    public AlgebraTileTerm Term => AlgebraTileTerm.One;
    public AlgebraTileSign Sign { get; }
    public IAlgebraTileShape Shape { get; } = new SquareTileShape(AlgebraTileSide.One);
    public IAlgebraTile Opposite() => new OneTile(
        Sign == AlgebraTileSign.Positive ? AlgebraTileSign.Negative : AlgebraTileSign.Positive);
}

public sealed record XTile : IAlgebraTile
{
    public XTile(AlgebraTileSign sign = AlgebraTileSign.Positive)
    {
        if (!Enum.IsDefined(sign))
            throw new ArgumentOutOfRangeException(nameof(sign), sign, "An algebra tile must be positive or negative.");
        Sign = sign;
    }

    public AlgebraTileTerm Term => AlgebraTileTerm.X;
    public AlgebraTileSign Sign { get; }
    public IAlgebraTileShape Shape { get; } = new RectangleTileShape(AlgebraTileSide.X, AlgebraTileSide.One);
    public IAlgebraTile Opposite() => new XTile(
        Sign == AlgebraTileSign.Positive ? AlgebraTileSign.Negative : AlgebraTileSign.Positive);
}

public sealed record YTile : IAlgebraTile
{
    public YTile(AlgebraTileSign sign = AlgebraTileSign.Positive)
    {
        if (!Enum.IsDefined(sign))
            throw new ArgumentOutOfRangeException(nameof(sign), sign, "An algebra tile must be positive or negative.");
        Sign = sign;
    }

    public AlgebraTileTerm Term => AlgebraTileTerm.Y;
    public AlgebraTileSign Sign { get; }
    public IAlgebraTileShape Shape { get; } = new RectangleTileShape(AlgebraTileSide.Y, AlgebraTileSide.One);
    public IAlgebraTile Opposite() => new YTile(
        Sign == AlgebraTileSign.Positive ? AlgebraTileSign.Negative : AlgebraTileSign.Positive);
}

public sealed record XSquaredTile : IAlgebraTile
{
    public XSquaredTile(AlgebraTileSign sign = AlgebraTileSign.Positive)
    {
        if (!Enum.IsDefined(sign))
            throw new ArgumentOutOfRangeException(nameof(sign), sign, "An algebra tile must be positive or negative.");
        Sign = sign;
    }

    public AlgebraTileTerm Term => AlgebraTileTerm.XSquared;
    public AlgebraTileSign Sign { get; }
    public IAlgebraTileShape Shape { get; } = new SquareTileShape(AlgebraTileSide.X);
    public IAlgebraTile Opposite() => new XSquaredTile(
        Sign == AlgebraTileSign.Positive ? AlgebraTileSign.Negative : AlgebraTileSign.Positive);
}

public sealed record YSquaredTile : IAlgebraTile
{
    public YSquaredTile(AlgebraTileSign sign = AlgebraTileSign.Positive)
    {
        if (!Enum.IsDefined(sign))
            throw new ArgumentOutOfRangeException(nameof(sign), sign, "An algebra tile must be positive or negative.");
        Sign = sign;
    }

    public AlgebraTileTerm Term => AlgebraTileTerm.YSquared;
    public AlgebraTileSign Sign { get; }
    public IAlgebraTileShape Shape { get; } = new SquareTileShape(AlgebraTileSide.Y);
    public IAlgebraTile Opposite() => new YSquaredTile(
        Sign == AlgebraTileSign.Positive ? AlgebraTileSign.Negative : AlgebraTileSign.Positive);
}

public sealed record XYTile : IAlgebraTile
{
    public XYTile(AlgebraTileSign sign = AlgebraTileSign.Positive)
    {
        if (!Enum.IsDefined(sign))
            throw new ArgumentOutOfRangeException(nameof(sign), sign, "An algebra tile must be positive or negative.");
        Sign = sign;
    }

    public AlgebraTileTerm Term => AlgebraTileTerm.XY;
    public AlgebraTileSign Sign { get; }
    public IAlgebraTileShape Shape { get; } = new RectangleTileShape(AlgebraTileSide.X, AlgebraTileSide.Y);
    public IAlgebraTile Opposite() => new XYTile(
        Sign == AlgebraTileSign.Positive ? AlgebraTileSign.Negative : AlgebraTileSign.Positive);
}

public union AlgebraTiles(OneTile, XTile, YTile, XSquaredTile, YSquaredTile, XYTile);

public static class AlgebraTileCatalog
{
    /// <summary>All six concrete types, each with a positive and a negative tile.</summary>
    public static readonly IReadOnlyList<IAlgebraTile> All = Array.AsReadOnly<IAlgebraTile>(
    [
        new OneTile(), new OneTile(AlgebraTileSign.Negative),
        new XTile(), new XTile(AlgebraTileSign.Negative),
        new YTile(), new YTile(AlgebraTileSign.Negative),
        new XSquaredTile(), new XSquaredTile(AlgebraTileSign.Negative),
        new YSquaredTile(), new YSquaredTile(AlgebraTileSign.Negative),
        new XYTile(), new XYTile(AlgebraTileSign.Negative)
    ]);
}
