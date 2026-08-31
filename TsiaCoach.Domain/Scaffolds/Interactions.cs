using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Scaffolds;

public sealed record MatchEquivalentLength;
public sealed record ClassifyByFit;
public sealed record NameFitClassification(FitClassification Classification);
public sealed record TraverseAllGaps;
public sealed record JoinQuantities;
public sealed record EnterScalar(ScalarReading Reading);
public sealed record BuildExpression;
public sealed record SelectAnswerChoice;

public union LearnerAction(
    MatchEquivalentLength,
    ClassifyByFit,
    NameFitClassification,
    TraverseAllGaps,
    JoinQuantities,
    EnterScalar,
    BuildExpression,
    SelectAnswerChoice
);

public sealed record LengthsAreEquivalent;
public sealed record MatchesComputedFit;
public sealed record MatchesIntegerDomain(
    FitClassification Classification,
    IntegerDomain Domain
);
public sealed record AllGapsTraversed(
    ScaffoldResourceId RequiredResourceId
);
public sealed record MatchesPartComposition;
public sealed record MatchesLatentScalar(
    LatentMathId ExpectedValueId,
    ScalarReading Reading
);
public sealed record MatchesLatentExpression(
    LatentMathId ExpectedExpressionId
);
public sealed record MatchesCorrectAnswer;

public union SuccessCheck(
    LengthsAreEquivalent,
    MatchesComputedFit,
    MatchesIntegerDomain,
    AllGapsTraversed,
    MatchesPartComposition,
    MatchesLatentScalar,
    MatchesLatentExpression,
    MatchesCorrectAnswer
);

public enum ScalarReading
{
    UnitLength,
    RodCount
}
