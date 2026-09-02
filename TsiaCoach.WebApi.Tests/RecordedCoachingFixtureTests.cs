using Microsoft.Extensions.Options;
using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.WebApi.Attempts;
using TsiaCoach.WebApi.CoachingAgents;
using TsiaCoach.WebApi.Request;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

/// <summary>
/// Recorded coaching fixtures that replay the production attempt derivation,
/// coaching policy, definition factory, and response validator without a web
/// host, network, or model provider. Each fixture pairs a submitted answer
/// history and requested event with fake model JSON and asserts what the
/// production pipeline authorizes.
/// </summary>
public sealed class RecordedCoachingFixtureTests
{
    private const string OfflineModel = "offline-fixture-model";
    private const string ItemWithScaffold = "practice-item-sample-1";
    private const string ItemWithoutScaffold = "practice-item-sample-2";

    private static readonly SamplePracticeCatalog Catalog = new();

    private static readonly CoachingAgentDefinitionFactory DefinitionFactory =
        new(Options.Create(new CoachingAgentOptions { Model = OfflineModel }));

    [Test]
    public async Task RecordedFixture_StructuralProbeAnswerRoutesToConsecutiveOdds()
    {
        RecordedFixture fixture = StructuralProbeFixture();
        (CoachingAgentDefinition definition, CoachTurnValidationResult result) =
            Run(fixture);

        await Assert.That(definition.AllowedMoves).IsEquivalentTo(
            new[] { CoachContractNames.RouteToStep });
        await Assert.That(definition.AuthorizedSuggestedStepId).IsNull();
        await Assert.That(result.IsValid).IsTrue();
        var move = (RouteToStepResponse)result.Response!.Move;
        await Assert.That(move.StepId).IsEqualTo("step-select-consecutive-odds");
        await Assert.That(move.Message).Contains("one left over after pairing");
        await Assert.That(result.ResolvedProbeShapeId).IsEqualTo("structural");
    }

    [Test]
    public async Task RecordedFixture_LookupRuleProbeAnswerRoutesToFloor()
    {
        RecordedFixture fixture = LookupRuleProbeFixture();
        (_, CoachTurnValidationResult result) = Run(fixture);

        await Assert.That(result.IsValid).IsTrue();
        var move = (RouteToStepResponse)result.Response!.Move;
        await Assert.That(move.StepId).IsEqualTo("step-rebuild-from-twos-and-ones");
        await Assert.That(move.Message).Contains("That rule works");
    }

    [Test]
    public async Task RecordedFixture_InitialIncorrectProducesAllowListedDiagnosis()
    {
        RecordedFixture fixture = InitialIncorrectFixture();
        (CoachingAgentDefinition definition, CoachTurnValidationResult result) =
            Run(fixture);

        await Assert.That(definition.AllowedMoves).IsEquivalentTo(
            new[] { CoachContractNames.DiagnoseDifference });
        await Assert.That(definition.AuthorizedSuggestedStepId).IsNull();
        await Assert.That(result.IsValid).IsTrue();
        await Assert.That(result.Response!.Move)
            .IsTypeOf<DiagnoseDifferenceResponse>();
    }

    [Test]
    public async Task RecordedFixture_EscalatedRouteAllowsOnlyExactScaffoldEntry()
    {
        RecordedFixture fixture = EscalatedScaffoldFixture();
        (CoachingAgentDefinition definition, CoachTurnValidationResult result) =
            Run(fixture);

        await Assert.That(definition.AllowedMoves).IsEquivalentTo(
            new[]
            {
                CoachContractNames.DiagnoseDifference,
                CoachContractNames.SuggestScaffold
            });
        await Assert.That(definition.AuthorizedSuggestedStepId)
            .IsEqualTo("step-join-and-read-sum");
        await Assert.That(result.IsValid).IsTrue();
        var move = (SuggestScaffoldResponse)result.Response!.Move;
        await Assert.That(move.SuggestedStepId)
            .IsEqualTo("step-join-and-read-sum");

        CoachTurnValidationResult foreignStep = CoachTurnValidator.Validate(
            SuggestJson("step-select-consecutive-odds"),
            definition);
        await Assert.That(foreignStep.IsValid).IsFalse();
    }

    [Test]
    public async Task RecordedFixture_DifferentRouteResetsScaffoldCapability()
    {
        RecordedFixture fixture = DifferentRouteFixture();
        (CoachingAgentDefinition definition, CoachTurnValidationResult result) =
            Run(fixture);

        await Assert.That(definition.AllowedMoves).IsEquivalentTo(
            new[] { CoachContractNames.DiagnoseDifference });
        await Assert.That(definition.AuthorizedSuggestedStepId).IsNull();
        await Assert.That(result.IsValid).IsTrue();
        await Assert.That(result.Response!.Move)
            .IsTypeOf<DiagnoseDifferenceResponse>();

        CoachTurnValidationResult scaffoldSuggestion = CoachTurnValidator.Validate(
            SuggestJson("step-join-and-read-sum"),
            definition);
        await Assert.That(scaffoldSuggestion.IsValid).IsFalse();
    }

    [Test]
    public async Task RecordedFixture_NoScaffoldItemRejectsScaffoldSuggestion()
    {
        RecordedFixture fixture = NoScaffoldFixture();
        (CoachingAgentDefinition definition, CoachTurnValidationResult result) =
            Run(fixture);

        await Assert.That(definition.AllowedMoves).IsEquivalentTo(
            new[] { CoachContractNames.DiagnoseDifference });
        await Assert.That(definition.AuthorizedSuggestedStepId).IsNull();
        await Assert.That(result.IsValid).IsTrue();
        await Assert.That(result.Response!.Move)
            .IsTypeOf<DiagnoseDifferenceResponse>();

        CoachTurnValidationResult scaffoldSuggestion = CoachTurnValidator.Validate(
            SuggestJson("step-join-and-read-sum"),
            definition);
        await Assert.That(scaffoldSuggestion.IsValid).IsFalse();
    }

    [Test]
    public async Task RecordedFixture_CorrectFirstCheckProducesAuthorizedExplanation()
    {
        RecordedFixture fixture = CorrectFirstCheckFixture();
        (CoachingAgentDefinition definition, CoachTurnValidationResult result) =
            Run(fixture);

        await Assert.That(definition.AllowedMoves).IsEquivalentTo(
            new[] { CoachContractNames.ExplainWhy });
        await Assert.That(definition.AuthorizedProvenanceFactIds.Count > 0).IsTrue();
        await Assert.That(result.IsValid).IsTrue();
        var move = (ExplainWhyResponse)result.Response!.Move;
        await Assert.That(move.ProvenanceFactIds
            .All(definition.AuthorizedProvenanceFactIds.Contains)).IsTrue();
    }

    [Test]
    public async Task RecordedFixture_CorrectAfterRevisionProducesAuthorizedExplanation()
    {
        RecordedFixture fixture = CorrectAfterRevisionFixture();
        (CoachingAgentDefinition definition, CoachTurnValidationResult result) =
            Run(fixture);

        await Assert.That(definition.AllowedMoves).IsEquivalentTo(
            new[] { CoachContractNames.ExplainWhy });
        await Assert.That(definition.AuthorizedProvenanceFactIds.Count > 0).IsTrue();
        await Assert.That(result.IsValid).IsTrue();
        var move = (ExplainWhyResponse)result.Response!.Move;
        await Assert.That(move.ProvenanceFactIds.Count > 0).IsTrue();
        await Assert.That(move.ProvenanceFactIds
            .All(definition.AuthorizedProvenanceFactIds.Contains)).IsTrue();
    }

    [Test]
    public async Task RecordedFixtures_AllPassProductionValidator()
    {
        foreach (RecordedFixture fixture in AllFixtures())
        {
            (CoachingAgentDefinition definition, CoachTurnValidationResult result) =
                Run(fixture);

            await Assert.That(result.IsValid).IsTrue();
            await Assert.That(result.Response!.Move.GetType())
                .IsEqualTo(fixture.ExpectedMove);
            await Assert.That(definition.AllowedMoves
                .Contains(fixture.ExpectedMoveName)).IsTrue();
        }
    }

    [Test]
    public async Task RecordedFixtures_RequireNoNetworkOrModelCredentials()
    {
        // The whole fixture pipeline runs in-process: catalog, attempt
        // derivation, coaching policy, definition factory, and validator.
        // No ICoachingAgentRunner, HttpClient, endpoint, or credential is
        // constructed, and the model name is an offline placeholder that no
        // provider would accept.
        foreach (RecordedFixture fixture in AllFixtures())
        {
            (CoachingAgentDefinition definition, CoachTurnValidationResult result) =
                Run(fixture);

            await Assert.That(definition.Model).IsEqualTo(OfflineModel);
            await Assert.That(result.IsValid).IsTrue();
        }
    }

    [Test]
    public async Task RecordedFixtures_NegativeCompanionsAreRejectedByProductionValidator()
    {
        // Unknown move on the probe classification.
        (CoachingAgentDefinition probe, _) = Run(StructuralProbeFixture());
        await Assert.That(CoachTurnValidator.Validate(
            """
            {"move":"revealAnswer","message":"Here it is.","focusPhraseIds":[],"suggestedStepId":null,"provenanceFactIds":[]}
            """,
            probe).IsValid).IsFalse();

        // Foreign shape id.
        await Assert.That(CoachTurnValidator.Validate(
            """{"move":"routeToStep","shapeId":"shape-not-authored"}""",
            probe).IsValid).IsFalse();

        // Model tries to write the route itself.
        await Assert.That(CoachTurnValidator.Validate(
            """{"move":"routeToStep","shapeId":"structural","stepId":"step-name-bar-count"}""",
            probe).IsValid).IsFalse();

        // Foreign phrase ID on a diagnosis.
        (CoachingAgentDefinition initial, _) = Run(InitialIncorrectFixture());
        await Assert.That(CoachTurnValidator.Validate(
            """
            {"move":"diagnoseDifference","message":"Look here.","focusPhraseIds":["phrase-not-authored"],"suggestedStepId":null,"provenanceFactIds":[]}
            """,
            initial).IsValid).IsFalse();

        // Foreign scaffold step on an escalated route.
        (CoachingAgentDefinition escalated, _) = Run(EscalatedScaffoldFixture());
        await Assert.That(CoachTurnValidator.Validate(
            SuggestJson("step-not-authored"),
            escalated).IsValid).IsFalse();

        // Foreign provenance fact after a correct check.
        (CoachingAgentDefinition correct, _) = Run(CorrectFirstCheckFixture());
        await Assert.That(CoachTurnValidator.Validate(
            """
            {"move":"explainWhy","message":"Because.","focusPhraseIds":[],"suggestedStepId":null,"provenanceFactIds":["latent-not-authored"]}
            """,
            correct).IsValid).IsFalse();

        // Scaffold suggestion before escalation.
        await Assert.That(CoachTurnValidator.Validate(
            SuggestJson("step-join-and-read-sum"),
            initial).IsValid).IsFalse();
    }

    private sealed record RecordedFixture(
        string PracticeItemId,
        IReadOnlyList<string> AnswerHistory,
        CoachTurnEvent RequestedEvent,
        Func<CoachingAgentDefinition, string> ModelJson,
        Type ExpectedMove,
        string ExpectedMoveName,
        string? ProbeAnswer = null);

    private static RecordedFixture StructuralProbeFixture() => new(
        ItemWithScaffold,
        [],
        CoachTurnEvent.ProbeAnswered,
        _ => """{"move":"routeToStep","shapeId":"structural"}""",
        typeof(RouteToStepResponse),
        CoachContractNames.RouteToStep,
        ProbeAnswer: "you can't pair them up, one is always left over");

    private static RecordedFixture LookupRuleProbeFixture() => new(
        ItemWithScaffold,
        [],
        CoachTurnEvent.ProbeAnswered,
        _ => """{"move":"routeToStep","shapeId":"lookup-rule"}""",
        typeof(RouteToStepResponse),
        CoachContractNames.RouteToStep,
        ProbeAnswer: "it ends in 1 3 5 7 or 9");

    private static RecordedFixture InitialIncorrectFixture() => new(
        ItemWithScaffold,
        ["answer-b"],
        CoachTurnEvent.DiagnosisRequested,
        _ => DiagnoseJson(),
        typeof(DiagnoseDifferenceResponse),
        CoachContractNames.DiagnoseDifference);

    private static RecordedFixture EscalatedScaffoldFixture() => new(
        ItemWithScaffold,
        ["answer-b", "answer-b"],
        CoachTurnEvent.DiagnosisRequested,
        definition => SuggestJson(definition.AuthorizedSuggestedStepId!),
        typeof(SuggestScaffoldResponse),
        CoachContractNames.SuggestScaffold);

    private static RecordedFixture DifferentRouteFixture() => new(
        ItemWithScaffold,
        ["answer-b", "answer-a"],
        CoachTurnEvent.DiagnosisRequested,
        _ => DiagnoseJson(),
        typeof(DiagnoseDifferenceResponse),
        CoachContractNames.DiagnoseDifference);

    private static RecordedFixture NoScaffoldFixture() => new(
        ItemWithoutScaffold,
        ["answer-b", "answer-b"],
        CoachTurnEvent.DiagnosisRequested,
        _ => DiagnoseJson(),
        typeof(DiagnoseDifferenceResponse),
        CoachContractNames.DiagnoseDifference);

    private static RecordedFixture CorrectFirstCheckFixture() => new(
        ItemWithScaffold,
        ["answer-d"],
        CoachTurnEvent.ExplainCorrect,
        ExplainJson,
        typeof(ExplainWhyResponse),
        CoachContractNames.ExplainWhy);

    private static RecordedFixture CorrectAfterRevisionFixture() => new(
        ItemWithScaffold,
        ["answer-b", "answer-d"],
        CoachTurnEvent.ExplainCorrect,
        ExplainJson,
        typeof(ExplainWhyResponse),
        CoachContractNames.ExplainWhy);

    private static IEnumerable<RecordedFixture> AllFixtures()
    {
        yield return StructuralProbeFixture();
        yield return LookupRuleProbeFixture();
        yield return InitialIncorrectFixture();
        yield return EscalatedScaffoldFixture();
        yield return DifferentRouteFixture();
        yield return NoScaffoldFixture();
        yield return CorrectFirstCheckFixture();
        yield return CorrectAfterRevisionFixture();
    }

    private static (CoachingAgentDefinition Definition, CoachTurnValidationResult Result)
        Run(RecordedFixture fixture)
    {
        if (!Catalog.TryFind(fixture.PracticeItemId, out PracticeItemCatalogEntry entry))
        {
            throw new InvalidOperationException(
                $"Fixture practice item '{fixture.PracticeItemId}' is not in the catalog.");
        }

        Attempt attempt = BuildAttempt(entry, fixture.AnswerHistory);
        CoachingAgentDefinition definition = DefinitionFactory.Create(
            attempt,
            entry,
            fixture.RequestedEvent,
            fixture.ProbeAnswer);
        CoachTurnValidationResult result = CoachTurnValidator.Validate(
            fixture.ModelJson(definition),
            definition);

        return (definition, result);
    }

    private static Attempt BuildAttempt(
        PracticeItemCatalogEntry entry,
        IReadOnlyList<string> answerHistory)
    {
        Attempt attempt = Attempt.Start(
            new AttemptId("attempt-recorded-fixture"),
            entry.Item);

        DateTimeOffset checkedAt = DateTimeOffset.UnixEpoch;
        for (int index = 0; index < answerHistory.Count; index++)
        {
            checkedAt = checkedAt.AddMinutes(1);
            attempt = attempt.Append(
                new CheckResultId($"check-{index + 1}"),
                new AnswerChoiceId(answerHistory[index]),
                checkedAt,
                entry.Item);
        }

        return attempt;
    }

    private static string DiagnoseJson() =>
        """
        {"move":"diagnoseDifference","message":"Your answer stops before combining both quantities.","focusPhraseIds":["phrase-target"],"suggestedStepId":null,"provenanceFactIds":[]}
        """;

    private static string SuggestJson(string stepId) =>
        $$"""
        {"move":"suggestScaffold","message":"Try a guided walkthrough of this step.","focusPhraseIds":["phrase-target"],"suggestedStepId":"{{stepId}}","provenanceFactIds":[]}
        """;

    private static string ExplainJson(CoachingAgentDefinition definition)
    {
        string factId = definition.AuthorizedProvenanceFactIds.First();

        return $$"""
            {"move":"explainWhy","message":"The source facts combine into the simplified sum.","focusPhraseIds":["phrase-target"],"suggestedStepId":null,"provenanceFactIds":["{{factId}}"]}
            """;
    }
}
