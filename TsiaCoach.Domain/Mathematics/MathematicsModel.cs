using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Mathematics;

public sealed record MathematicsModel(
    IReadOnlyList<MathObject> Objects,
    IReadOnlyList<MathTextBinding> TextBindings
);

public sealed record MathObject(
    MathObjectId Id,
    MathNodeId RootNodeId,
    IReadOnlyList<MathNode> Nodes
);

public sealed record MathNode(
    MathNodeId Id,
    MathNodeKind Kind,
    string? Value,
    IReadOnlyList<MathNodeId> ChildNodeIds
);

public sealed record MathTextBinding(
    MathObjectId MathObjectId,
    MathNodeId? MathNodeId,
    CharacterSpan CharacterSpan
);

public enum MathNodeKind
{
    IntegerLiteral,
    SymbolReference,
    Addition,
    Multiplication
}
