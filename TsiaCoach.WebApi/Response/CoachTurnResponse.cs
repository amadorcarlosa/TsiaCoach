using System.Text.Json.Serialization;

namespace TsiaCoach.WebApi.Response;

public sealed record CoachTurnResponse(
    CoachMoveResponse Move);

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(AskProbeResponse), "askProbe")]
[JsonDerivedType(typeof(RouteToStepResponse), "routeToStep")]
[JsonDerivedType(typeof(DiagnoseDifferenceResponse), "diagnoseDifference")]
[JsonDerivedType(typeof(SuggestScaffoldResponse), "suggestScaffold")]
[JsonDerivedType(typeof(ExplainWhyResponse), "explainWhy")]
public abstract record CoachMoveResponse(
    string Message,
    IReadOnlyList<string> FocusPhraseIds);

/// <summary>The authored probe question. Served without a model call.</summary>
public sealed record AskProbeResponse(
    string Message,
    IReadOnlyList<string> FocusPhraseIds)
    : CoachMoveResponse(Message, FocusPhraseIds);

/// <summary>
/// The authored route for the shape the student's probe answer resolved to.
/// The message is authored per shape; the model contributes only the shape.
/// </summary>
public sealed record RouteToStepResponse(
    string Message,
    IReadOnlyList<string> FocusPhraseIds,
    string StepId)
    : CoachMoveResponse(Message, FocusPhraseIds);

public sealed record DiagnoseDifferenceResponse(
    string Message,
    IReadOnlyList<string> FocusPhraseIds)
    : CoachMoveResponse(Message, FocusPhraseIds);

public sealed record SuggestScaffoldResponse(
    string Message,
    IReadOnlyList<string> FocusPhraseIds,
    string SuggestedStepId)
    : CoachMoveResponse(Message, FocusPhraseIds);

public sealed record ExplainWhyResponse(
    string Message,
    IReadOnlyList<string> FocusPhraseIds,
    IReadOnlyList<string> ProvenanceFactIds)
    : CoachMoveResponse(Message, FocusPhraseIds);
