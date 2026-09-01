using TsiaCoach.WebApi.Agents;

namespace TsiaCoach.WebApi.CoachingAgents;

public sealed class CoachingAgentOptions
{
    public string Model { get; set; } =
        Models.Gpt.Model.Five.Version.Four.Type.Mini.Name;
}
