using System.Net;
using System.Net.Http.Json;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

public sealed class ScaffoldEndpointTests : ApiTestBase
{
    [Test]
    public async Task List_ReturnsParityLadderWithPolymorphicResources()
    {
        using HttpClient client = Factory.CreateClient();

        ScaffoldResponse[]? scaffolds = await client.GetFromJsonAsync<ScaffoldResponse[]>(
            "/api/scaffolds");

        await Assert.That(scaffolds is not null).IsTrue();
        await Assert.That(scaffolds!.Length).IsEqualTo(1);

        ScaffoldResponse scaffold = scaffolds.Single();
        RodResourceResponse stepRod = scaffold.Resources
            .OfType<RodResourceResponse>()
            .Single(resource => resource.Id == "resource-odd-step-rod");
        LatentLengthReferenceResponse length =
            stepRod.Length as LatentLengthReferenceResponse ??
            throw new InvalidOperationException("Expected a latent length reference.");
        RodSeriesResourceResponse series = scaffold.Resources
            .OfType<RodSeriesResourceResponse>()
            .Single();

        await Assert.That(scaffold.Id)
            .IsEqualTo("scaffold-parity-ladder");
        await Assert.That(scaffold.PracticeItemId)
            .IsEqualTo("practice-item-sample-1");
        await Assert.That(stepRod.Multiplicity)
            .IsEqualTo("singleton");
        await Assert.That(stepRod.Role)
            .IsEqualTo("probeAndStep");
        await Assert.That(length.LatentMathId)
            .IsEqualTo("latent-ordered-step");
        await Assert.That(series.Lengths)
            .IsEquivalentTo(Enumerable.Range(1, 10));
    }

    [Test]
    public async Task Detail_ExposesOneFlatPathWithPurposeLabels()
    {
        using HttpClient client = Factory.CreateClient();

        ScaffoldResponse? scaffold = await client.GetFromJsonAsync<ScaffoldResponse>(
            "/api/scaffolds/scaffold-parity-ladder");

        await Assert.That(scaffold is not null).IsTrue();
        await Assert.That(scaffold!.Steps.Count).IsEqualTo(6);
        await Assert.That(scaffold.Steps.Select(step => step.Id))
            .IsEquivalentTo(
            [
                "step-rebuild-from-twos-and-ones",
                "step-remove-paired-evens",
                "step-select-consecutive-odds",
                "step-join-and-read-sum",
                "step-name-bar-count",
                "step-name-leftover-length"
            ]);
        await Assert.That(scaffold.Steps[0].Purpose).IsEqualTo("conceptFormation");
        await Assert.That(scaffold.Steps[^1].Purpose).IsEqualTo("generalization");

        RodGapSceneResponse gap =
            FindStep(scaffold, "step-select-consecutive-odds").Scene as RodGapSceneResponse ??
            throw new InvalidOperationException("Expected a rod-gap scene.");
        await Assert.That(gap.StepRodId).IsEqualTo("resource-odd-step-rod");
        await Assert.That(gap.SpanSeriesId).IsEqualTo("resource-measurand-series");
        await Assert.That(gap.IncludedOutcome).IsEqualTo("oneUnitLeftover");

        QuantityJoinSceneResponse join = QuantityJoinSceneFor(
            FindStep(scaffold, "step-join-and-read-sum"));
        await Assert.That(join.Parts.Count).IsEqualTo(2);
        await Assert.That(join.Bindings.Count).IsEqualTo(0);
        await Assert.That(join.ShowSizedTarget).IsFalse();
    }

    [Test]
    public async Task Detail_PreservesTypedScalarReadings()
    {
        using HttpClient client = Factory.CreateClient();

        ScaffoldResponse? scaffold = await client.GetFromJsonAsync<ScaffoldResponse>(
            "/api/scaffolds/scaffold-parity-ladder");

        ScaffoldStepResponse countStep = FindStep(scaffold!, "step-name-bar-count");
        ScaffoldStepResponse lengthStep = FindStep(scaffold, "step-name-leftover-length");
        EnterScalarActionResponse countAction =
            countStep.Action as EnterScalarActionResponse ??
            throw new InvalidOperationException("Expected a scalar-entry action.");
        MatchesLatentScalarCheckResponse countCheck =
            countStep.SuccessCheck as MatchesLatentScalarCheckResponse ??
            throw new InvalidOperationException("Expected a latent-scalar check.");
        EnterScalarActionResponse lengthAction =
            lengthStep.Action as EnterScalarActionResponse ??
            throw new InvalidOperationException("Expected a scalar-entry action.");
        MatchesLatentScalarCheckResponse lengthCheck =
            lengthStep.SuccessCheck as MatchesLatentScalarCheckResponse ??
            throw new InvalidOperationException("Expected a latent-scalar check.");

        await Assert.That(countAction.Reading).IsEqualTo("rodCount");
        await Assert.That(countCheck.ExpectedValueId)
            .IsEqualTo("latent-like-term-count");
        await Assert.That(lengthAction.Reading).IsEqualTo("unitLength");
        await Assert.That(lengthCheck.ExpectedValueId)
            .IsEqualTo("latent-ordered-step");
        await Assert.That(QuantityJoinSceneFor(countStep).Parts)
            .IsEquivalentTo(QuantityJoinSceneFor(lengthStep).Parts);
    }

    [Test]
    public async Task UnknownScaffold_ReturnsNotFound()
    {
        using HttpClient client = Factory.CreateClient();

        using HttpResponseMessage response = await client.GetAsync(
            "/api/scaffolds/does-not-exist");

        await Assert.That(response.StatusCode)
            .IsEqualTo(HttpStatusCode.NotFound);
    }

    private static ScaffoldStepResponse FindStep(
        ScaffoldResponse scaffold,
        string id) =>
        scaffold.Steps.Single(step => step.Id == id);

    private static QuantityJoinSceneResponse QuantityJoinSceneFor(
        ScaffoldStepResponse step) =>
        step.Scene as QuantityJoinSceneResponse ??
            throw new InvalidOperationException("Expected a quantity-join scene.");
}
