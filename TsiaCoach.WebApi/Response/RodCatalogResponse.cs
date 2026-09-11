using TsiaCoach.Domain.Manipulatives;
using TsiaCoach.Domain.Scaffolds;

namespace TsiaCoach.WebApi.Response;

public sealed record RodDimensionsResponse(int Width, int Depth, int Height);
public sealed record RodPoseResponse(RodOrientation Orientation, RodDimensionsResponse Dimensions);
public sealed record RodDefinitionResponse(int Length, RodColor Color, IReadOnlyList<RodPoseResponse> Poses);

public static class RodCatalogResponse
{
    public static RodDefinitionResponse[] Create() => Rod.All.Select(rod =>
        new RodDefinitionResponse(rod.Units, rod.Color,
            Enum.GetValues<RodOrientation>().Select(orientation =>
            {
                RodDimensions size = new RodPlacement(rod, new GridCell(0, 0), orientation).Dimensions;
                return new RodPoseResponse(orientation, new(size.Width, size.Depth, size.Height));
            }).ToArray())).ToArray();
}
