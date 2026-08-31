using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Scaffolds;

public sealed record FreshScene(
    ScaffoldScene Definition
);

public sealed record ContinuedScene(
    ScaffoldStepId SourceStepId,
    SceneAccess Access
);

public union StepScene(
    FreshScene,
    ContinuedScene
);

public sealed record RodEquivalenceScene(
    ScaffoldResourceId UnitRodId,
    ScaffoldResourceId ProbeRodId
);

public sealed record RodMeasurementScene(
    ScaffoldResourceId ProbeRodId,
    ScaffoldResourceId SpanSeriesId
);

public sealed record RodGapScene(
    ScaffoldResourceId StepRodId,
    ScaffoldStepId ClassificationStepId,
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

public enum SceneAccess
{
    Interactive,
    Frozen
}

public enum FitClassification
{
    Flush,
    OneUnitLeftover
}
