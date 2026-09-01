using System.Text.Json.Serialization;

namespace TsiaCoach.WebApi.Request;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CoachTurnRequest(
    [property: JsonRequired] CoachTurnEvent Event);

public enum CoachTurnEvent
{
    [JsonStringEnumMemberName("helpRequested")]
    HelpRequested,

    [JsonStringEnumMemberName("diagnosisRequested")]
    DiagnosisRequested,

    [JsonStringEnumMemberName("explainCorrect")]
    ExplainCorrect
}
