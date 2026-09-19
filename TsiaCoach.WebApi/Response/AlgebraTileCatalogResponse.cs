using TsiaCoach.Domain.Manipulatives;

namespace TsiaCoach.WebApi.Response;

public enum AlgebraTileShape { Square, Rectangle }

public sealed record AlgebraTileDimensionsResponse(AlgebraTileSide Width, AlgebraTileSide Height);

public sealed record AlgebraTileDefinitionResponse(
    AlgebraTileTerm Term,
    AlgebraTileSign Sign,
    int Coefficient,
    AlgebraTileShape Shape,
    AlgebraTileDimensionsResponse Dimensions);

public static class AlgebraTileCatalogResponse
{
    public static AlgebraTileDefinitionResponse[] Create() => AlgebraTileCatalog.All.Select(tile =>
        {
            AlgebraTileDimensions size = tile.Dimensions;
            return new AlgebraTileDefinitionResponse(tile.Term, tile.Sign, tile.Coefficient, ShapeOf(tile.Shape),
                new(size.Width, size.Height));
        }).ToArray();

    private static AlgebraTileShape ShapeOf(IAlgebraTileShape shape) => shape switch
    {
        SquareTileShape => AlgebraTileShape.Square,
        RectangleTileShape => AlgebraTileShape.Rectangle,
        _ => throw new InvalidOperationException($"Unsupported tile shape: {shape.GetType().Name}.")
    };
}
