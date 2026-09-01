using TsiaCoach.WebApi.Request;

namespace TsiaCoach.WebApi.CoachingAgents;

public sealed record CoachingAgentDefinition(
    string Model,
    string SystemPrompt,
    string Prompt,
    string Phase,
    IReadOnlySet<string> AllowedMoves,
    IReadOnlySet<string> AuthorizedFocusPhraseIds,
    string? AuthorizedSuggestedStepId,
    IReadOnlySet<string> AuthorizedProvenanceFactIds);

internal static class CoachContractNames
{
    public const string BeforeCheck = "beforeCheck";
    public const string AfterIncorrectCheck = "afterIncorrectCheck";
    public const string AfterCorrectCheck = "afterCorrectCheck";

    public const string HelpRequested = "helpRequested";
    public const string DiagnosisRequested = "diagnosisRequested";
    public const string ExplainCorrect = "explainCorrect";

    public const string AskReadingQuestion = "askReadingQuestion";
    public const string DiagnoseDifference = "diagnoseDifference";
    public const string SuggestScaffold = "suggestScaffold";
    public const string ExplainWhy = "explainWhy";

    public static string EventName(CoachTurnEvent value) =>
        value switch
        {
            CoachTurnEvent.HelpRequested => HelpRequested,
            CoachTurnEvent.DiagnosisRequested => DiagnosisRequested,
            CoachTurnEvent.ExplainCorrect => ExplainCorrect,
            _ => throw new InvalidOperationException(
                $"Unsupported coaching event '{value}'.")
        };
}
