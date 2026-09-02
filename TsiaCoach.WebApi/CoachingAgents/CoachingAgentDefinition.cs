using TsiaCoach.WebApi.Request;

namespace TsiaCoach.WebApi.CoachingAgents;

/// <summary>
/// The authored resolution behind one probe answer shape. The validator uses
/// it to build the student-facing route from a bare shape id, so the model
/// never writes the step or the message.
/// </summary>
public sealed record ProbeShapeResolution(
    string StepId,
    string Message,
    IReadOnlyList<string> FocusPhraseIds);

public sealed record CoachingAgentDefinition(
    string Model,
    string SystemPrompt,
    string Prompt,
    string Phase,
    IReadOnlySet<string> AllowedMoves,
    IReadOnlySet<string> AuthorizedFocusPhraseIds,
    string? AuthorizedSuggestedStepId,
    IReadOnlySet<string> AuthorizedProvenanceFactIds,
    IReadOnlyDictionary<string, ProbeShapeResolution>? AuthorizedProbeShapes = null);

internal static class CoachContractNames
{
    public const string BeforeCheck = "beforeCheck";
    public const string AfterIncorrectCheck = "afterIncorrectCheck";
    public const string AfterCorrectCheck = "afterCorrectCheck";

    public const string HelpRequested = "helpRequested";
    public const string ProbeAnswered = "probeAnswered";
    public const string DiagnosisRequested = "diagnosisRequested";
    public const string ExplainCorrect = "explainCorrect";

    public const string AskProbe = "askProbe";
    public const string RouteToStep = "routeToStep";
    public const string DiagnoseDifference = "diagnoseDifference";
    public const string SuggestScaffold = "suggestScaffold";
    public const string ExplainWhy = "explainWhy";

    public static string EventName(CoachTurnEvent value) =>
        value switch
        {
            CoachTurnEvent.HelpRequested => HelpRequested,
            CoachTurnEvent.ProbeAnswered => ProbeAnswered,
            CoachTurnEvent.DiagnosisRequested => DiagnosisRequested,
            CoachTurnEvent.ExplainCorrect => ExplainCorrect,
            _ => throw new InvalidOperationException(
                $"Unsupported coaching event '{value}'.")
        };
}
