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

/// <summary>What a <see cref="GridPiece"/> is, for the wire and for rendering.</summary>
public enum PieceKind
{
    Rod,
    Variable,
    Constant
}

/// <summary>
/// A variable tile: no fixed length, drawn <see cref="DrawnLength"/> cells
/// wide from <see cref="Origin"/>, labelled <see cref="Symbol"/>.
/// </summary>
public sealed record VariableTile(
    SymbolName Symbol,
    int DrawnLength,
    GridCell Origin
);

/// <summary>A constant +1 tile, one cell wide, at <see cref="Origin"/>.</summary>
public sealed record ConstantTile(
    GridCell Origin
);

/// <summary>
/// One piece drawn on a grid: a Cuisenaire rod at a cell (a
/// <see cref="RodPlacement"/>, the same object a learner drops), a variable
/// tile, or a constant +1 tile. Coordinates are grid cells; y grows downward.
/// </summary>
public union GridPiece(
    RodPlacement,
    VariableTile,
    ConstantTile
);

/// <summary>The footprint every kind of piece shares: where it starts and which cells it covers. Tiles always lie horizontally.</summary>
public static class GridPieceExtensions
{
    extension(GridPiece piece)
    {
        public PieceKind Kind => piece.Value switch
        {
            RodPlacement => PieceKind.Rod,
            VariableTile => PieceKind.Variable,
            ConstantTile => PieceKind.Constant,
            _ => throw UnsupportedPiece(piece)
        };

        public GridCell Origin => piece.Value switch
        {
            RodPlacement rod => rod.Origin,
            VariableTile tile => tile.Origin,
            ConstantTile tile => tile.Origin,
            _ => throw UnsupportedPiece(piece)
        };

        public int Length => piece.Value switch
        {
            RodPlacement rod => rod.Length,
            VariableTile tile => tile.DrawnLength,
            ConstantTile => 1,
            _ => throw UnsupportedPiece(piece)
        };

        public RodOrientation Orientation => piece.Value switch
        {
            RodPlacement rod => rod.Orientation,
            VariableTile or ConstantTile => RodOrientation.Horizontal,
            _ => throw UnsupportedPiece(piece)
        };

        public int X => piece.Origin.X;

        public int Y => piece.Origin.Y;

        /// <summary>Cells covered left to right.</summary>
        public int Width =>
            piece.Orientation == RodOrientation.Horizontal ? piece.Length : 1;

        /// <summary>Cells covered top to bottom.</summary>
        public int Height =>
            piece.Orientation == RodOrientation.Horizontal ? 1 : piece.Length;

        /// <summary>The first column after the piece.</summary>
        public int Right => piece.X + piece.Width;

        /// <summary>The first row after the piece.</summary>
        public int Bottom => piece.Y + piece.Height;

        public string? Symbol =>
            piece.Value is VariableTile tile ? tile.Symbol.Value : null;

        public bool Overlaps(GridPiece other) =>
            piece.X < other.Right && other.X < piece.Right &&
            piece.Y < other.Bottom && other.Y < piece.Bottom;
    }

    private static InvalidOperationException UnsupportedPiece(GridPiece piece) =>
        new($"Unsupported grid piece case: {piece.Value?.GetType().Name ?? "null"}.");
}

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
