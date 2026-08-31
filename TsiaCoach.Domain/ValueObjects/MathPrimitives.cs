namespace TsiaCoach.Domain.ValueObjects;

public readonly record struct SymbolName(string Value);
public readonly record struct ExpressionText(string Value);

public readonly record struct UnitLength
{
    public UnitLength(int value)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(value);
        Value = value;
    }

    public int Value { get; }
}

public readonly record struct RodCount
{
    public RodCount(int value)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(value);
        Value = value;
    }

    public int Value { get; }
}
