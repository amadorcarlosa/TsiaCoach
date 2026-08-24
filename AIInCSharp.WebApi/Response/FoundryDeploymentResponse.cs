using AIInCSharp.WebApi.Agents;
using static AIInCSharp.WebApi.Agents.Models;

namespace AIInCSharp.WebApi.Response;

public record FoundryDeploymentResponse(string Name, string DisplayName, VendorName Vendor);



public static class FoundryDeployments
{
    public static readonly IReadOnlyList<FoundryDeploymentResponse> All =
    [
        new(Gpt.Model.Five.Version.Four.Type.Mini.Name, Gpt.Model.Five.Version.Four.Type.Mini.View, Gpt.Vendor),
        new(Gpt.Model.Five.Chat.Name, Gpt.Model.Five.Chat.View, Gpt.Vendor),
        new(Gpt.Model.Five.Version.Six.Type.Sol.Name, Gpt.Model.Five.Version.Six.Type.Sol.View, Gpt.Vendor),
        new(Gpt.Model.Five.Nano.Name, Gpt.Model.Five.Nano.View, Gpt.Vendor),
        new(DeepSeek.Model.Version.Four.Type.Pro.Name, DeepSeek.Model.Version.Four.Type.Pro.View, DeepSeek.Vendor),
        new(Claude.Model.Opus.Version.Five.Name, Claude.Model.Opus.Version.Five.View, Claude.Vendor),
    ];
}
    
