using System.Text.Json.Serialization;

namespace TsiaCoach.WebApi.Response;

public sealed record CoachTurnResponse(
    CoachMoveResponse Move);

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(AskReadingQuestionResponse), "askReadingQuestion")]
[JsonDerivedType(typeof(DiagnoseDifferenceResponse), "diagnoseDifference")]
[JsonDerivedType(typeof(SuggestScaffoldResponse), "suggestScaffold")]
[JsonDerivedType(typeof(ExplainWhyResponse), "explainWhy")]
public abstract record CoachMoveResponse(
    string Message,
    IReadOnlyList<string> FocusPhraseIds);

public sealed record AskReadingQuestionResponse(
    string Message,
    IReadOnlyList<string> FocusPhraseIds)
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
