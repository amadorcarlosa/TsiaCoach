using AIInCSharp.WebApi.Agents;

namespace AIInCSharp.WebApi.Response;

public sealed record FoundryDeploymentResponse(
    string Name,
    string DisplayName,
    VendorName Vendor);

public static class FoundryDeployments
{
    public static IReadOnlyList<FoundryDeploymentResponse> All { get; } =
    [
        .. ModelCatalog.All.Select(model =>
            new FoundryDeploymentResponse(
                model.Name,
                model.DisplayName,
                model.Vendor.WireName))
    ];
}