using System.Text.Json.Serialization;

namespace TsiaCoach.WebApi.Request;

/// <summary>
/// The browser sends only a coaching event, plus the student's free-text
/// probe answer when the event is <c>probeAnswered</c>, or the step id and
/// free-text question when the event is <c>stepQuestionAsked</c>. Everything
/// else (phase, diagnosis, route, model) is derived on the server.
/// </summary>
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CoachTurnRequest(
    [property: JsonRequired] CoachTurnEvent Event,
    string? Answer = null,
    string? StepId = null,
    string? Question = null);

public enum CoachTurnEvent
{
    [JsonStringEnumMemberName("helpRequested")]
    HelpRequested,

    [JsonStringEnumMemberName("probeAnswered")]
    ProbeAnswered,

    [JsonStringEnumMemberName("diagnosisRequested")]
    DiagnosisRequested,

    [JsonStringEnumMemberName("explainCorrect")]
    ExplainCorrect,

    [JsonStringEnumMemberName("stepQuestionAsked")]
    StepQuestionAsked
}
