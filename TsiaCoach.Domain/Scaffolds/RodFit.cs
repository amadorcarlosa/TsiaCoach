using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Scaffolds;

public sealed record FlushFit(
    RodCount CompleteRods
);

public sealed record RemainderFit(
    RodCount CompleteRods,
    UnitLength Remainder
);

public union FitOutcome(
    FlushFit,
    RemainderFit
);

public static class RodFit
{
    public static FitOutcome Measure(
        UnitLength measuringRod,
        UnitLength span)
    {
        int completeRods = Math.DivRem(
            span.Value,
            measuringRod.Value,
            out int remainder);

        return remainder == 0
            ? new FlushFit(new(completeRods))
            : new RemainderFit(
                CompleteRods: new(completeRods),
                Remainder: new(remainder));
    }
}
