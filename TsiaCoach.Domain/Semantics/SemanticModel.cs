namespace TsiaCoach.Domain.Semantics;

public sealed record SemanticModel(
    IReadOnlyList<SemanticEntity> Entities,
    IReadOnlyList<SemanticEdge> Edges,
    IReadOnlyList<LatentMath> LatentFacts
);