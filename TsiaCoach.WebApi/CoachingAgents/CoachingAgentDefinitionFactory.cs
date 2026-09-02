using System.Text.Json;
using System.Text.Encodings.Web;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.ScaffoldSessions;
using TsiaCoach.Domain.Text;
using TsiaCoach.Domain.ValueObjects;
using TsiaCoach.WebApi.Attempts;
using TsiaCoach.WebApi.Request;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.CoachingAgents;

public sealed class CoachingAgentDefinitionFactory(
    IOptions<CoachingAgentOptions> options)
{
    private const string SystemPrompt = """
        You are a student-facing algebra coaching agent.
        Use only the server-provided coaching context.
        Do not infer the attempt phase, correctness, misconception, hint level, route, scaffold authorization, or provenance.
        Return exactly one JSON object with properties: move, message, focusPhraseIds, suggestedStepId, provenanceFactIds.
        Choose move only from the context's allowedMoves.
        Use focusPhraseIds only for phrase ids listed in the context; never use token ids.
        Set suggestedStepId to null unless move is "suggestScaffold"; then use only the context's authorizedScaffoldEntry.entryStepId.
        Set provenanceFactIds to an empty array unless move is "explainWhy"; then use only ids from the context's whyItWorks.provenanceFacts.
        Never invent ids. Any other value in those fields causes the response to be rejected.
        Do not wrap the JSON in Markdown fences and do not add trailing prose.
        """;

    private static readonly JsonSerializerOptions PromptJsonOptions =
        new(JsonSerializerDefaults.Web)
        {
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            WriteIndented = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

    public CoachingAgentDefinition Create(
        Attempt attempt,
        PracticeItemCatalogEntry entry,
        CoachTurnEvent requestedEvent)
    {
        object phase = attempt.Phase(entry.Item).Value
            ?? throw new InvalidOperationException(
                "Attempt phase projection returned no value.");

        return phase switch
        {
            BeforeCheck => CreateBeforeCheck(entry.Item, requestedEvent),
            AfterIncorrectCheck incorrect => CreateAfterIncorrect(
                attempt,
                entry,
                incorrect,
                requestedEvent),
            AfterCorrectCheck => CreateAfterCorrect(
                attempt,
                entry.Item,
                requestedEvent),
            _ => throw new InvalidOperationException(
                $"Unsupported coaching phase '{phase.GetType().Name}'.")
        };
    }

    private CoachingAgentDefinition CreateBeforeCheck(
        PracticeItem item,
        CoachTurnEvent requestedEvent)
    {
        string[] allowedMoves =
        [
            CoachContractNames.AskReadingQuestion
        ];

        var context = new BeforeCheckPromptContext(
            Phase: CoachContractNames.BeforeCheck,
            Event: CoachContractNames.EventName(requestedEvent),
            AllowedMoves: allowedMoves,
            PromptText: item.Text.SourceText,
            SafeTokens: item.Text.Tokens
                .Select(ToContext)
                .ToArray(),
            AuthorizedPhrases: PhraseContexts(item),
            PedagogicalInstruction:
                "Ask one reading question that helps the student use the problem wording.");

        return CreateDefinition(
            CoachContractNames.BeforeCheck,
            context,
            allowedMoves,
            AuthorizedPhraseIds(item),
            authorizedSuggestedStepId: null,
            authorizedProvenanceFactIds: EmptyStringSet());
    }

    private CoachingAgentDefinition CreateAfterIncorrect(
        Attempt attempt,
        PracticeItemCatalogEntry entry,
        AfterIncorrectCheck phase,
        CoachTurnEvent requestedEvent)
    {
        PracticeItem item = entry.Item;
        CoachingDiagnosisProjection diagnosis =
            entry.CoachingPolicy.ProjectDiagnosis(attempt, item);
        ScaffoldSessionGrant? grant =
            ScaffoldSessionAuthorizer
                .Authorize(attempt, item, entry.CoachingPolicy)
                .Value as ScaffoldSessionGrant;

        string[] allowedMoves = grant is null
            ? [CoachContractNames.DiagnoseDifference]
            :
            [
                CoachContractNames.DiagnoseDifference,
                CoachContractNames.SuggestScaffold
            ];

        var context = new AfterIncorrectPromptContext(
            Phase: CoachContractNames.AfterIncorrectCheck,
            Event: CoachContractNames.EventName(requestedEvent),
            AllowedMoves: allowedMoves,
            PromptText: item.Text.SourceText,
            SelectedAnswerText: AnswerText(item, phase.SelectedAnswerId),
            Diagnosis: new IncorrectDiagnosisContext(
                MisconceptionCode: diagnosis.Misconception.Value,
                PhasePurpose: ContractName(diagnosis.Purpose),
                HintLevel: ContractName(diagnosis.HintLevel),
                RouteStreak: diagnosis.RouteStreak),
            AuthorizedPhraseAnchors: PhraseContexts(item),
            AuthorizedScaffoldEntry: grant is null
                ? null
                : new AuthorizedScaffoldEntryContext(
                    ScaffoldId: grant.ScaffoldId.Value,
                    EntryStepId: grant.EntryStepId.Value));

        return CreateDefinition(
            CoachContractNames.AfterIncorrectCheck,
            context,
            allowedMoves,
            AuthorizedPhraseIds(item),
            grant?.EntryStepId.Value,
            authorizedProvenanceFactIds: EmptyStringSet());
    }

    private CoachingAgentDefinition CreateAfterCorrect(
        Attempt attempt,
        PracticeItem item,
        CoachTurnEvent requestedEvent)
    {
        WhyItWorksResponse whyItWorks =
            WhyItWorksProjector.Project(attempt, item);
        ProvenanceFactContext[] facts = whyItWorks.ProvenanceChain
            .Select(ToContext)
            .ToArray();
        string[] allowedMoves =
        [
            CoachContractNames.ExplainWhy
        ];

        var context = new AfterCorrectPromptContext(
            Phase: CoachContractNames.AfterCorrectCheck,
            Event: CoachContractNames.EventName(requestedEvent),
            AllowedMoves: allowedMoves,
            PromptText: item.Text.SourceText,
            WhyItWorks: new WhyItWorksContext(
                AttemptId: whyItWorks.AttemptId,
                PracticeItemId: whyItWorks.PracticeItemId,
                SelectedAnswerId: whyItWorks.SelectedAnswerId,
                CheckCount: whyItWorks.CheckCount,
                ProvenanceFacts: facts));

        return CreateDefinition(
            CoachContractNames.AfterCorrectCheck,
            context,
            allowedMoves,
            AuthorizedPhraseIds(item),
            authorizedSuggestedStepId: null,
            authorizedProvenanceFactIds: facts
                .Select(fact => fact.Id)
                .ToHashSet(StringComparer.Ordinal));
    }

    private CoachingAgentDefinition CreateDefinition(
        string phase,
        object context,
        IReadOnlyList<string> allowedMoves,
        IReadOnlySet<string> authorizedFocusPhraseIds,
        string? authorizedSuggestedStepId,
        IReadOnlySet<string> authorizedProvenanceFactIds) =>
        new(
            Model: options.Value.Model,
            SystemPrompt: SystemPrompt,
            Prompt: JsonSerializer.Serialize(context, PromptJsonOptions),
            Phase: phase,
            AllowedMoves: allowedMoves.ToHashSet(StringComparer.Ordinal),
            AuthorizedFocusPhraseIds: authorizedFocusPhraseIds,
            AuthorizedSuggestedStepId: authorizedSuggestedStepId,
            AuthorizedProvenanceFactIds: authorizedProvenanceFactIds);

    private static TokenContext ToContext(TextToken token) =>
        new(
            Id: token.Id.Value,
            Text: token.Surface,
            Kind: ContractName(token.Kind));

    private static IReadOnlySet<string> EmptyStringSet() =>
        new HashSet<string>(StringComparer.Ordinal);

    private static IReadOnlySet<string> AuthorizedPhraseIds(PracticeItem item) =>
        item.Text.Phrases
            .Select(phrase => phrase.Id.Value)
            .ToHashSet(StringComparer.Ordinal);

    private static PhraseContext[] PhraseContexts(PracticeItem item) =>
        item.Text.Phrases
            .Select(phrase => new PhraseContext(
                phrase.Id.Value,
                TextFor(item, phrase.CharacterSpan)))
            .ToArray();

    private static string AnswerText(
        PracticeItem item,
        AnswerChoiceId answerChoiceId)
    {
        AnswerChoice answer = item.Answers
            .Single(candidate => candidate.Id == answerChoiceId);

        return TextFor(item, answer.ContentCharacterSpan);
    }

    private static string TextFor(
        PracticeItem item,
        CharacterSpan span) =>
        item.Text.SourceText.Substring(span.Start, span.Length);

    private static ProvenanceFactContext ToContext(
        LatentMathResponse response) =>
        response switch
        {
            DerivedScalarResponse scalar => new(
                Id: scalar.Id,
                Kind: "derivedScalar",
                Meaning: scalar.Meaning,
                Value: scalar.Value,
                MathObjectId: null,
                Provenance: scalar.Provenance),
            DerivedExpressionResponse expression => new(
                Id: expression.Id,
                Kind: "derivedExpression",
                Meaning: expression.Meaning,
                Value: null,
                MathObjectId: expression.MathObjectId,
                Provenance: expression.Provenance),
            _ => throw new InvalidOperationException(
                $"Unsupported provenance fact '{response.GetType().Name}'.")
        };

    private static string ContractName<TEnum>(TEnum value)
        where TEnum : struct, Enum
    {
        string name = value.ToString();

        return name.Length == 0
            ? name
            : char.ToLowerInvariant(name[0]) + name[1..];
    }

    private sealed record TokenContext(
        string Id,
        string Text,
        string Kind);

    private sealed record PhraseContext(
        string Id,
        string Text);

    private sealed record BeforeCheckPromptContext(
        string Phase,
        string Event,
        IReadOnlyList<string> AllowedMoves,
        string PromptText,
        IReadOnlyList<TokenContext> SafeTokens,
        IReadOnlyList<PhraseContext> AuthorizedPhrases,
        string PedagogicalInstruction);

    private sealed record IncorrectDiagnosisContext(
        string MisconceptionCode,
        string PhasePurpose,
        string HintLevel,
        int RouteStreak);

    private sealed record AuthorizedScaffoldEntryContext(
        string ScaffoldId,
        string EntryStepId);

    private sealed record AfterIncorrectPromptContext(
        string Phase,
        string Event,
        IReadOnlyList<string> AllowedMoves,
        string PromptText,
        string SelectedAnswerText,
        IncorrectDiagnosisContext Diagnosis,
        IReadOnlyList<PhraseContext> AuthorizedPhraseAnchors,
        AuthorizedScaffoldEntryContext? AuthorizedScaffoldEntry);

    private sealed record WhyItWorksContext(
        string AttemptId,
        string PracticeItemId,
        string SelectedAnswerId,
        int CheckCount,
        IReadOnlyList<ProvenanceFactContext> ProvenanceFacts);

    private sealed record ProvenanceFactContext(
        string Id,
        string Kind,
        string Meaning,
        decimal? Value,
        string? MathObjectId,
        LatentMathProvenanceResponse Provenance);

    private sealed record AfterCorrectPromptContext(
        string Phase,
        string Event,
        IReadOnlyList<string> AllowedMoves,
        string PromptText,
        WhyItWorksContext WhyItWorks);
}
