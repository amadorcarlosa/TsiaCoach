using TsiaCoach.Domain.Manipulatives;

namespace TsiaCoach.WebApi.Response;

public sealed record BaseTenBlockDimensionsResponse(int Width, int Depth, int Height);

public sealed record BaseTenBlockDefinitionResponse(Base10Denomination Denomination, int Value, string Shape, BaseTenBlockDimensionsResponse Dimensions);

public static class BaseTenBlockCatalogResponse
{
    public static BaseTenBlockDefinitionResponse[] Create() => BaseTenBlockCatalog.All.Select(block =>
        {
            Dimensions size = block.Dimensions;
            return new BaseTenBlockDefinitionResponse(block.Denomination, block.Value, ShapeName(block.Shape),
                new(size.Width, size.Depth, size.Height));
        }).ToArray();

    private static string ShapeName(IBlockShape shape) => shape switch
    {
        CubeShape => "cube",
        LongShape => "long",
        FlatShape => "flat",
        _ => throw new InvalidOperationException($"Unsupported block shape: {shape.GetType().Name}.")
    };
}
