using TsiaCoach.Domain.Manipulatives;

namespace TsiaCoach.WebApi.Response;

public enum BaseTenShape { Cube, Long, Flat }

public sealed record BaseTenBlockDimensionsResponse(int Width, int Depth, int Height);

public sealed record BaseTenBlockDefinitionResponse(Base10Denomination Denomination, int Value, BaseTenShape Shape, BaseTenBlockDimensionsResponse Dimensions);

public static class BaseTenBlockCatalogResponse
{
    public static BaseTenBlockDefinitionResponse[] Create() => BaseTenBlockCatalog.All.Select(block =>
        {
            Dimensions size = block.Dimensions;
            return new BaseTenBlockDefinitionResponse(block.Denomination, block.Value, ShapeOf(block.Shape),
                new(size.Width, size.Depth, size.Height));
        }).ToArray();

    private static BaseTenShape ShapeOf(IBlockShape shape) => shape switch
    {
        CubeShape => BaseTenShape.Cube,
        LongShape => BaseTenShape.Long,
        FlatShape => BaseTenShape.Flat,
        _ => throw new InvalidOperationException($"Unsupported block shape: {shape.GetType().Name}.")
    };
}
