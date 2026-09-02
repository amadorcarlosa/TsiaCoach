using Microsoft.Extensions.Options;
using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.WebApi.Attempts;
using TsiaCoach.WebApi.CoachingAgents;
using TsiaCoach.WebApi.Request;

namespace TsiaCoach.WebApi.Tests;

public sealed class CoachingAgentDefinitionTests
{
    private const string StructuralAnswer = "there is one left over when you pair them up";

    [Test]
    public async Task ProbeDefinition_ContainsQuestionShapesAndStudentAnswerOnly()
    {
        CoachingAgentDefinition definition = CreateDefinition(
            AttemptFor(CatalogEntry("practice-item-sample-1").Item),
            "practice-item-sample-1",
            CoachTurnEvent.ProbeAnswered,
            StructuralAnswer);

        await Assert.That(definition.Phase)
            .IsEqualTo(CoachContractNames.BeforeCheck);
        await Assert.That(definition.AllowedMoves)
            .IsEquivalentTo(new[] { CoachContractNames.RouteToStep });
        await Assert.That(definition.Prompt)
            .Contains("what makes a number odd");
        await Assert.That(definition.Prompt)
            .Contains("\"studentAnswer\": \"" + StructuralAnswer + "\"");
        foreach (string shapeId in new[] { "no-answer", "wrong-answer", "lookup-rule", "structural" })
        {
            await Assert.That(definition.Prompt).Contains($"\"id\": \"{shapeId}\"");
        }

        await Assert.That(definition.AuthorizedProbeShapes).IsNotNull();
        await Assert.That(definition.AuthorizedProbeShapes!.Count).IsEqualTo(4);
        await Assert.That(definition.AuthorizedProbeShapes["structural"].StepId)
            .IsEqualTo("step-select-consecutive-odds");
        await Assert.That(definition.AuthorizedProbeShapes["lookup-rule"].StepId)
            .IsEqualTo("step-rebuild-from-twos-and-ones");
    }

    [Test]
    public async Task ProbeDefinition_KeepsStepIdsAndRouteMessagesOffTheModelContext()
    {
        CoachingAgentDefinition definition = CreateDefinition(
            AttemptFor(CatalogEntry("practice-item-sample-1").Item),
            "practice-item-sample-1",
            CoachTurnEvent.ProbeAnswered,
            StructuralAnswer);

        await AssertPromptExcludes(
            definition,
            "step-",
            "Let's start at the beginning",
            "correctAnswerId",
            "misconceptionCode",
            "authorizedScaffoldEntry",
            "successCheck",
            "latent-",
            "distractor",
            "safeTokens");
    }

    [Test]
    public async Task ProbeDefinition_RequiresAnAnswer()
    {
        await AssertInvalid(() => CreateDefinition(
            AttemptFor(CatalogEntry("practice-item-sample-1").Item),
            "practice-item-sample-1",
            CoachTurnEvent.ProbeAnswered,
            "   "));
    }

    [Test]
    public async Task HelpBeforeCheck_HasNoModelTurn()
    {
        await AssertInvalid(() => CreateDefinition(
            AttemptFor(CatalogEntry("practice-item-sample-1").Item),
            "practice-item-sample-1",
            CoachTurnEvent.HelpRequested));
    }

    [Test]
    public async Task ProbeDefinition_RejectsItemWithoutProbe()
    {
        await AssertInvalid(() => CreateDefinition(
            AttemptFor(CatalogEntry("practice-item-sample-2").Item),
            "practice-item-sample-2",
            CoachTurnEvent.ProbeAnswered,
            StructuralAnswer));
    }

    [Test]
    public async Task IncorrectDefinition_ContainsLatestServerDerivedDiagnosis()
    {
        PracticeItemCatalogEntry entry = CatalogEntry("practice-item-sample-1");
        CoachingAgentDefinition definition = CreateDefinition(
            AttemptFor(entry.Item, "answer-a", "answer-b"),
            "practice-item-sample-1",
            CoachTurnEvent.DiagnosisRequested);

        await Assert.That(definition.Phase)
            .IsEqualTo(CoachContractNames.AfterIncorrectCheck);
        await Assert.That(definition.Prompt)
            .Contains("stopped-at-second-integer");
        await Assert.That(definition.Prompt)
            .Contains("\"phasePurpose\": \"representation\"");
        await Assert.That(definition.Prompt)
            .Contains("\"hintLevel\": \"initial\"");
        await Assert.That(definition.Prompt)
            .Contains("\"routeStreak\": 1");
        await Assert.That(definition.Prompt)
            .Contains("\"selectedAnswerText\": \"n + 2\"");
        await Assert.That(definition.AuthorizedProbeShapes).IsNull();
    }

    [Test]
    public async Task IncorrectDefinition_ExcludesCorrectAnswerAndLatentFacts()
    {
        PracticeItemCatalogEntry entry = CatalogEntry("practice-item-sample-1");
        CoachingAgentDefinition definition = CreateDefinition(
            AttemptFor(entry.Item, "answer-b"),
            "practice-item-sample-1",
            CoachTurnEvent.DiagnosisRequested);

        await AssertPromptExcludes(
            definition,
            "correctAnswerId",
            "answer-d",
            "latent-",
            "requestedValue",
            "successCheck");
    }

    [Test]
    public async Task IncorrectDefinition_WithEscalatedRouteIncludesExactAuthorizedEntry()
    {
        PracticeItemCatalogEntry entry = CatalogEntry("practice-item-sample-1");
        CoachingAgentDefinition definition = CreateDefinition(
            AttemptFor(entry.Item, "answer-b", "answer-b"),
            "practice-item-sample-1",
            CoachTurnEvent.DiagnosisRequested);

        await Assert.That(definition.AllowedMoves.Contains(
                CoachContractNames.SuggestScaffold))
            .IsTrue();
        await Assert.That(definition.AuthorizedSuggestedStepId)
            .IsEqualTo("step-join-and-read-sum");
        await Assert.That(definition.Prompt)
            .Contains("\"scaffoldId\": \"scaffold-parity-ladder\"");
        await Assert.That(definition.Prompt)
            .Contains("\"entryStepId\": \"step-join-and-read-sum\"");
        await Assert.That(definition.Prompt)
            .DoesNotContain("step-name-bar-count");
    }

    [Test]
    public async Task IncorrectDefinition_WithoutScaffoldExcludesScaffoldCapability()
    {
        PracticeItemCatalogEntry entry = CatalogEntry("practice-item-sample-2");
        CoachingAgentDefinition definition = CreateDefinition(
            AttemptFor(entry.Item, "answer-a", "answer-a"),
            "practice-item-sample-2",
            CoachTurnEvent.DiagnosisRequested);

        await Assert.That(definition.AllowedMoves.Contains(
                CoachContractNames.SuggestScaffold))
            .IsFalse();
        await Assert.That(definition.AuthorizedSuggestedStepId)
            .IsNull();
        await Assert.That(definition.Prompt)
            .DoesNotContain("authorizedScaffoldEntry");
    }

    [Test]
    public async Task CorrectDefinition_ContainsSourceFirstWhyItWorksProvenance()
    {
        PracticeItemCatalogEntry entry = CatalogEntry("practice-item-sample-1");
        CoachingAgentDefinition definition = CreateDefinition(
            AttemptFor(entry.Item, "answer-d"),
            "practice-item-sample-1",
            CoachTurnEvent.ExplainCorrect);

        string[] ids =
        [
            "latent-ordered-step",
            "latent-second-member",
            "latent-requested-value-composed",
            "latent-like-term-count",
            "latent-requested-value-simplified"
        ];

        int previous = -1;
        foreach (string id in ids)
        {
            int current = definition.Prompt.IndexOf(
                id,
                StringComparison.Ordinal);
            await Assert.That(current).IsGreaterThan(previous);
            previous = current;
        }
    }

    [Test]
    public async Task CorrectDefinition_ExcludesDistractorsAndMisconceptions()
    {
        PracticeItemCatalogEntry entry = CatalogEntry("practice-item-sample-1");
        CoachingAgentDefinition definition = CreateDefinition(
            AttemptFor(entry.Item, "answer-d"),
            "practice-item-sample-1",
            CoachTurnEvent.ExplainCorrect);

        await AssertPromptExcludes(
            definition,
            "distractors",
            "ordinary-step-and-missing-sum",
            "stopped-at-second-integer",
            "ordinary-step-in-sum",
            "successCheck");
    }

    [Test]
    public async Task Definition_UsesConfiguredModelAndServerOwnedInstructions()
    {
        PracticeItemCatalogEntry entry = CatalogEntry("practice-item-sample-1");
        CoachingAgentDefinition definition = CreateDefinition(
            AttemptFor(entry.Item),
            "practice-item-sample-1",
            CoachTurnEvent.ProbeAnswered,
            StructuralAnswer);

        await Assert.That(definition.Model).IsEqualTo("gpt-5.6-sol");
        await Assert.That(definition.SystemPrompt)
            .Contains("server-provided coaching context");
        await Assert.That(definition.SystemPrompt)
            .Contains("untrusted student text");
        await Assert.That(definition.SystemPrompt)
            .Contains("\"routeToStep\"");
    }

    [Test]
    public async Task Definition_DoesNotContainClientConversationHistory()
    {
        PracticeItemCatalogEntry entry = CatalogEntry("practice-item-sample-1");
        CoachingAgentDefinition definition = CreateDefinition(
            AttemptFor(entry.Item),
            "practice-item-sample-1",
            CoachTurnEvent.ProbeAnswered,
            StructuralAnswer);

        await Assert.That(definition.Prompt)
            .DoesNotContain("previous student chat");
        await Assert.That(definition.Prompt)
            .DoesNotContain("history");
    }

    private static CoachingAgentDefinition CreateDefinition(
        Attempt attempt,
        string practiceItemId,
        CoachTurnEvent requestedEvent,
        string? probeAnswer = null)
    {
        var factory = new CoachingAgentDefinitionFactory(
            Options.Create(new CoachingAgentOptions
            {
                Model = "gpt-5.6-sol"
            }));

        return factory.Create(
            attempt,
            CatalogEntry(practiceItemId),
            requestedEvent,
            probeAnswer);
    }

    private static PracticeItemCatalogEntry CatalogEntry(string practiceItemId)
    {
        var catalog = new SamplePracticeCatalog();
        return catalog.TryFind(practiceItemId, out PracticeItemCatalogEntry? entry)
            ? entry
            : throw new InvalidOperationException("Missing sample catalog entry.");
    }

    private static Attempt AttemptFor(
        PracticeItem item,
        params string[] answerIds)
    {
        Attempt attempt = Attempt.Start(
            new AttemptId($"attempt-test-{Guid.NewGuid():N}"),
            item);

        for (int index = 0; index < answerIds.Length; index++)
        {
            attempt = attempt.Append(
                new CheckResultId($"check-test-{Guid.NewGuid():N}"),
                new AnswerChoiceId(answerIds[index]),
                DateTimeOffset.UnixEpoch.AddMinutes(index),
                item);
        }

        return attempt;
    }

    private static async Task AssertPromptExcludes(
        CoachingAgentDefinition definition,
        params string[] values)
    {
        foreach (string value in values)
        {
            await Assert.That(definition.Prompt)
                .DoesNotContain(value);
        }
    }

    private static async Task AssertInvalid(Func<CoachingAgentDefinition> create)
    {
        InvalidOperationException? exception = null;

        try
        {
            _ = create();
        }
        catch (InvalidOperationException caught)
        {
            exception = caught;
        }

        await Assert.That(exception is not null).IsTrue();
    }
}
