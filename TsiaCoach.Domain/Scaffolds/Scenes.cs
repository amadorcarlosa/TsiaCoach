using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Scaffolds;

public sealed record RodEquivalenceScene(
    ScaffoldResourceId UnitRodId,
    ScaffoldResourceId ProbeRodId
);

public sealed record RodMeasurementScene(
    ScaffoldResourceId ProbeRodId,
    ScaffoldResourceId SpanSeriesId
);

/// <summary>
/// Rods from <see cref="SpanSeriesId"/> whose fit against <see cref="StepRodId"/>
/// has <see cref="IncludedOutcome"/> are laid out, and the learner walks the
/// gaps between consecutive included rods with the step rod. The scene is
/// computed from resources alone so the step can render as an entry point.
/// </summary>
public sealed record RodGapScene(
    ScaffoldResourceId StepRodId,
    ScaffoldResourceId SpanSeriesId,
    FitClassification IncludedOutcome
);

public sealed record QuantityJoinScene(
    IReadOnlyList<QuantityReference> Parts,
    IReadOnlyList<InstructionalBinding> Bindings,
    bool ShowSizedTarget
);

public sealed record AnswerChoiceScene;

public enum PieceKind
{
    Rod,
    Variable,
    Constant
}

/// <summary>
/// One piece drawn on a grid: a Cuisenaire rod of a fixed length, a variable
/// tile (no fixed length, drawn <see cref="Length"/> cells wide), or a
/// constant +1 tile. Coordinates are grid cells; y grows downward.
/// </summary>
public sealed record GridPiece(
    PieceKind Kind,
    int Length,
    int X,
    int Y,
    string? Symbol = null
);

/// <summary>
/// A row the learner builds on: the cells from <see cref="Start"/> spanning
/// <see cref="Length"/> on row <see cref="Y"/>. For "build on top of the rod"
/// the target row coincides with a reference rod; for "build under it" the
/// target row sits below.
/// </summary>
public sealed record GridRow(
    int Y,
    int Start,
    int Length
);

/// <summary>
/// A free grid in the spirit of the physical board and the Brainingcamp
/// manipulative. <see cref="Reference"/> pieces are authored and fixed;
/// the learner acts on <see cref="TargetRows"/> (placing pieces), or on the
/// rows of the reference pieces themselves (clicking, moving). Everything
/// needed to render comes from this record, so any step is an entry point.
/// </summary>
public sealed record GridScene(
    int Cols,
    int Rows,
    IReadOnlyList<GridPiece> Reference,
    IReadOnlyList<GridRow> TargetRows,
    bool UnitLines = true
);

public union ScaffoldScene(
    RodEquivalenceScene,
    RodMeasurementScene,
    RodGapScene,
    QuantityJoinScene,
    AnswerChoiceScene,
    GridScene
);

public sealed record SemanticQuantityReference(
    SemanticEntityId SemanticEntityId
);

public sealed record LatentExpressionReference(
    LatentMathId LatentMathId
);

public union QuantityReference(
    SemanticQuantityReference,
    LatentExpressionReference
);

public sealed record InstructionalBinding(
    SemanticEntityId SemanticEntityId,
    UnitLength Value
);

public enum FitClassification
{
    Flush,
    OneUnitLeftover
}
