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

public union ScaffoldScene(
    RodEquivalenceScene,
    RodMeasurementScene,
    RodGapScene,
    QuantityJoinScene,
    AnswerChoiceScene
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
