namespace TsiaCoach.Domain.Manipulatives;

/// <summary>
/// The seven place values a base-10 block can represent, numbered by the
/// value each one stands for — the same "value carries its own meaning"
/// convention <see cref="RodColor"/> uses for length.
/// </summary>
public enum Base10Denomination
{
    Ones = 1,
    Tens = 10,
    Hundreds = 100,
    Thousands = 1_000,
    TenThousands = 10_000,
    HundredThousands = 100_000,
    Millions = 1_000_000
}

public readonly record struct Dimensions(int Width, int Depth, int Height);

public interface IBlockShape
{
    Dimensions GetDimensions();
}

public sealed record CubeShape(int Edge) : IBlockShape
{
    public Dimensions GetDimensions() => new(Width: Edge, Depth: Edge, Height: Edge);
}

public sealed record LongShape(int Edge) : IBlockShape
{
    public Dimensions GetDimensions() => new(Width: Edge * 10, Depth: Edge, Height: Edge);
}

public sealed record FlatShape(int Edge) : IBlockShape
{
    public Dimensions GetDimensions() => new(Width: Edge * 10, Depth: Edge * 10, Height: Edge);
}

public interface IBaseTenBlock
{
    Base10Denomination Denomination { get; }
    IBlockShape Shape { get; }
    int Value => (int)Denomination;
    Dimensions Dimensions => Shape.GetDimensions();
}

public sealed record OneBlock : IBaseTenBlock
{
    public Base10Denomination Denomination => Base10Denomination.Ones;
    public IBlockShape Shape { get; } = new CubeShape(Edge: 1);
}

public sealed record TenBlock : IBaseTenBlock
{
    public Base10Denomination Denomination => Base10Denomination.Tens;
    public IBlockShape Shape { get; } = new LongShape(Edge: 1);
}

public sealed record HundredBlock : IBaseTenBlock
{
    public Base10Denomination Denomination => Base10Denomination.Hundreds;
    public IBlockShape Shape { get; } = new FlatShape(Edge: 1);
}

public sealed record ThousandBlock : IBaseTenBlock
{
    public Base10Denomination Denomination => Base10Denomination.Thousands;
    public IBlockShape Shape { get; } = new CubeShape(Edge: 10);
}

public sealed record TenThousandBlock : IBaseTenBlock
{
    public Base10Denomination Denomination => Base10Denomination.TenThousands;
    public IBlockShape Shape { get; } = new LongShape(Edge: 10);
}

public sealed record HundredThousandBlock : IBaseTenBlock
{
    public Base10Denomination Denomination => Base10Denomination.HundredThousands;
    public IBlockShape Shape { get; } = new FlatShape(Edge: 10);
}

public sealed record MillionBlock : IBaseTenBlock
{
    public Base10Denomination Denomination => Base10Denomination.Millions;
    public IBlockShape Shape { get; } = new CubeShape(Edge: 100);
}

public union BaseTenBlocks(OneBlock, TenBlock, HundredBlock, ThousandBlock, TenThousandBlock, HundredThousandBlock, MillionBlock);

public static class BaseTenBlockCatalog
{
    public static readonly IReadOnlyList<IBaseTenBlock> All = Array.AsReadOnly<IBaseTenBlock>(
    [
        new OneBlock(), new TenBlock(), new HundredBlock(), new ThousandBlock(),
        new TenThousandBlock(), new HundredThousandBlock(), new MillionBlock()
    ]);
}
