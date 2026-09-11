using TsiaCoach.Domain.Manipulatives;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Scaffolds;

public sealed record RodResource(
    ScaffoldResourceId Id,
    LengthSource Length,
    ResourceMultiplicity Multiplicity,
    RodRole Role
);

public sealed record RodSeriesResource(
    ScaffoldResourceId Id,
    IReadOnlyList<UnitLength> Lengths
);

public sealed record BaseTenBlockResource(
    ScaffoldResourceId Id,
    Base10Denomination Denomination,
    ResourceMultiplicity Multiplicity
);

public union ScaffoldResource(
    RodResource,
    RodSeriesResource,
    BaseTenBlockResource
);

public sealed record LiteralLength(
    UnitLength Value
);

public sealed record LatentLengthReference(
    LatentMathId LatentMathId
);

public union LengthSource(
    LiteralLength,
    LatentLengthReference
);

public enum ResourceMultiplicity
{
    Singleton,
    Repeatable
}

public enum RodRole
{
    Unit,
    ProbeAndStep
}
