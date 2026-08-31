using TsiaCoach.Domain.ValueObjects;



namespace TsiaCoach.Domain.Semantics;

public sealed record DerivedScalar(
    LatentMathId Id,
    LatentScalarMeaning Meaning,
    decimal Value,
    LatentMathProvenance Provenance
);

public sealed record DerivedExpression(
    LatentMathId Id,
    LatentExpressionMeaning Meaning,
    MathObjectId MathObjectId,
    LatentMathProvenance Provenance
);

public union LatentMath(
    DerivedScalar,
    DerivedExpression
);

public sealed record LatentMathProvenance(
    LatentMathOrigin Origin,
    IReadOnlyList<PhraseId> AnchorPhraseIds,
    IReadOnlyList<SemanticEntityId> SourceEntityIds,
    IReadOnlyList<LatentMathId> SourceLatentMathIds
);

public enum LatentMathOrigin
{
    EncodedBySurfacePhrase,
    ImplicitlyDerived,
    Computed
}

public enum LatentScalarMeaning
{
    OrderedStep,
    ScaleFactor,
    Increment,
    LikeTermCount,
    ConstantTotal
}

public enum LatentExpressionMeaning
{
    QuantityDefinition,
    RequestedValueComposed,
    RequestedValueSimplified
}