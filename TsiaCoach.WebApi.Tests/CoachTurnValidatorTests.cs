using System.Text.Json;
using TsiaCoach.WebApi.CoachingAgents;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

public sealed class CoachTurnValidatorTests
{
    [Test]
    public async Task BeforeCheck_AllowsAskReadingQuestion()
    {
        CoachTurnValidationResult result = Validate(
            Output(CoachContractNames.AskReadingQuestion),
            Definition(
                CoachContractNames.BeforeCheck,
                [CoachContractNames.AskReadingQuestion]));

        await AssertValid<AskReadingQuestionResponse>(result);
    }

    [Test]
    public async Task BeforeCheck_RejectsDiagnosisMove()
    {
        CoachTurnValidationResult result = Validate(
            Output(CoachContractNames.DiagnoseDifference),
            Definition(
                CoachContractNames.BeforeCheck,
                [CoachContractNames.AskReadingQuestion]));

        await AssertInvalid(result);
    }

    [Test]
    public async Task Incorrect_AllowsDiagnoseDifference()
    {
        CoachTurnValidationResult result = Validate(
            Output(CoachContractNames.DiagnoseDifference),
            Definition(
                CoachContractNames.AfterIncorrectCheck,
                [CoachContractNames.DiagnoseDifference]));

        await AssertValid<DiagnoseDifferenceResponse>(result);
    }

    [Test]
    public async Task EscalatedIncorrect_AllowsExactScaffoldSuggestion()
    {
        CoachTurnValidationResult result = Validate(
            Output(
                CoachContractNames.SuggestScaffold,
                suggestedStepId: "step-entry"),
            Definition(
                CoachContractNames.AfterIncorrectCheck,
                [
                    CoachContractNames.DiagnoseDifference,
                    CoachContractNames.SuggestScaffold
                ],
                authorizedSuggestedStepId: "step-entry"));

        await AssertValid<SuggestScaffoldResponse>(result);
    }

    [Test]
    public async Task InitialIncorrect_RejectsScaffoldSuggestion()
    {
        CoachTurnValidationResult result = Validate(
            Output(
                CoachContractNames.SuggestScaffold,
                suggestedStepId: "step-entry"),
            Definition(
                CoachContractNames.AfterIncorrectCheck,
                [CoachContractNames.DiagnoseDifference]));

        await AssertInvalid(result);
    }

    [Test]
    public async Task NoScaffoldAuthored_RejectsScaffoldSuggestion()
    {
        CoachTurnValidationResult result = Validate(
            Output(
                CoachContractNames.SuggestScaffold,
                suggestedStepId: "step-entry"),
            Definition(
                CoachContractNames.AfterIncorrectCheck,
                [CoachContractNames.DiagnoseDifference],
                authorizedSuggestedStepId: null));

        await AssertInvalid(result);
    }

    [Test]
    public async Task Validator_RejectsForeignFocusPhrase()
    {
        CoachTurnValidationResult result = Validate(
            Output(
                CoachContractNames.AskReadingQuestion,
                focusPhraseIds: ["phrase-foreign"]),
            Definition(
                CoachContractNames.BeforeCheck,
                [CoachContractNames.AskReadingQuestion]));

        await AssertInvalid(result);
    }

    [Test]
    public async Task Validator_RejectsArbitrarySuggestedStep()
    {
        CoachTurnValidationResult result = Validate(
            Output(
                CoachContractNames.SuggestScaffold,
                suggestedStepId: "step-other"),
            Definition(
                CoachContractNames.AfterIncorrectCheck,
                [
                    CoachContractNames.DiagnoseDifference,
                    CoachContractNames.SuggestScaffold
                ],
                authorizedSuggestedStepId: "step-entry"));

        await AssertInvalid(result);
    }

    [Test]
    public async Task Validator_RejectsSuggestedStepOnWrongMove()
    {
        CoachTurnValidationResult result = Validate(
            Output(
                CoachContractNames.DiagnoseDifference,
                suggestedStepId: "step-entry"),
            Definition(
                CoachContractNames.AfterIncorrectCheck,
                [CoachContractNames.DiagnoseDifference],
                authorizedSuggestedStepId: "step-entry"));

        await AssertInvalid(result);
    }

    [Test]
    public async Task Correct_AllowsExplainWhy()
    {
        CoachTurnValidationResult result = Validate(
            Output(
                CoachContractNames.ExplainWhy,
                provenanceFactIds: ["latent-a"]),
            Definition(
                CoachContractNames.AfterCorrectCheck,
                [CoachContractNames.ExplainWhy],
                authorizedProvenanceFactIds: ["latent-a"]));

        await AssertValid<ExplainWhyResponse>(result);
    }

    [Test]
    public async Task Correct_RejectsForeignProvenanceFact()
    {
        CoachTurnValidationResult result = Validate(
            Output(
                CoachContractNames.ExplainWhy,
                provenanceFactIds: ["latent-foreign"]),
            Definition(
                CoachContractNames.AfterCorrectCheck,
                [CoachContractNames.ExplainWhy],
                authorizedProvenanceFactIds: ["latent-a"]));

        await AssertInvalid(result);
    }

    [Test]
    public async Task Validator_RejectsEmptyMessage()
    {
        CoachTurnValidationResult result = Validate(
            Output(
                CoachContractNames.AskReadingQuestion,
                message: " "),
            Definition(
                CoachContractNames.BeforeCheck,
                [CoachContractNames.AskReadingQuestion]));

        await AssertInvalid(result);
    }

    [Test]
    public async Task Validator_RejectsOversizedMessage()
    {
        CoachTurnValidationResult result = Validate(
            Output(
                CoachContractNames.AskReadingQuestion,
                message: new string('x', CoachTurnValidator.MaxMessageLength + 1)),
            Definition(
                CoachContractNames.BeforeCheck,
                [CoachContractNames.AskReadingQuestion]));

        await AssertInvalid(result);
    }

    [Test]
    public async Task Validator_RejectsMalformedJson()
    {
        CoachTurnValidationResult result = Validate(
            "{",
            Definition(
                CoachContractNames.BeforeCheck,
                [CoachContractNames.AskReadingQuestion]));

        await AssertInvalid(result);
    }

    [Test]
    public async Task Validator_RejectsMarkdownWrappedJson()
    {
        CoachTurnValidationResult result = Validate(
            """
            ```json
            {"move":"askReadingQuestion","message":"Try the wording.","focusPhraseIds":[],"suggestedStepId":null,"provenanceFactIds":[]}
            ```
            """,
            Definition(
                CoachContractNames.BeforeCheck,
                [CoachContractNames.AskReadingQuestion]));

        await AssertInvalid(result);
    }

    [Test]
    public async Task Validator_RejectsTrailingContent()
    {
        CoachTurnValidationResult result = Validate(
            Output(CoachContractNames.AskReadingQuestion) + " trailing",
            Definition(
                CoachContractNames.BeforeCheck,
                [CoachContractNames.AskReadingQuestion]));

        await AssertInvalid(result);
    }

    [Test]
    public async Task Validator_RejectsUnexpectedOutputProperty()
    {
        CoachTurnValidationResult result = Validate(
            """
            {"move":"askReadingQuestion","message":"Try the wording.","focusPhraseIds":[],"suggestedStepId":null,"provenanceFactIds":[],"model":"gpt"}
            """,
            Definition(
                CoachContractNames.BeforeCheck,
                [CoachContractNames.AskReadingQuestion]));

        await AssertInvalid(result);
    }

    private static CoachTurnValidationResult Validate(
        string output,
        CoachingAgentDefinition definition) =>
        CoachTurnValidator.Validate(output, definition);

    private static CoachingAgentDefinition Definition(
        string phase,
        IReadOnlyList<string> allowedMoves,
        string? authorizedSuggestedStepId = null,
        IReadOnlyList<string>? authorizedProvenanceFactIds = null)
    {
        authorizedProvenanceFactIds ??= [];

        return new(
            Model: "gpt-5.4-mini",
            SystemPrompt: "server prompt",
            Prompt: "{}",
            Phase: phase,
            AllowedMoves: allowedMoves.ToHashSet(StringComparer.Ordinal),
            AuthorizedFocusPhraseIds: new HashSet<string>(StringComparer.Ordinal)
            {
                "phrase-a"
            },
            AuthorizedSuggestedStepId: authorizedSuggestedStepId,
            AuthorizedProvenanceFactIds: authorizedProvenanceFactIds
                .ToHashSet(StringComparer.Ordinal));
    }

    private static string Output(
        string move,
        string message = "Try the wording.",
        IReadOnlyList<string>? focusPhraseIds = null,
        string? suggestedStepId = null,
        IReadOnlyList<string>? provenanceFactIds = null)
    {
        focusPhraseIds ??= [];
        provenanceFactIds ??= [];

        return $$"""
            {"move":{{JsonSerializer.Serialize(move)}},"message":{{JsonSerializer.Serialize(message)}},"focusPhraseIds":{{JsonSerializer.Serialize(focusPhraseIds)}},"suggestedStepId":{{JsonSerializer.Serialize(suggestedStepId)}},"provenanceFactIds":{{JsonSerializer.Serialize(provenanceFactIds)}}}
            """;
    }

    private static async Task AssertValid<TMove>(
        CoachTurnValidationResult result)
        where TMove : CoachMoveResponse
    {
        await Assert.That(result.IsValid).IsTrue();
        await Assert.That(result.Response is not null).IsTrue();
        await Assert.That(result.Response!.Move).IsTypeOf<TMove>();
    }

    private static async Task AssertInvalid(
        CoachTurnValidationResult result)
    {
        await Assert.That(result.IsValid).IsFalse();
        await Assert.That(result.Response).IsNull();
    }
}
