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
    public async Task Detail_PreservesSceneFadingAndTypedScalarReadings()
    {
        using HttpClient client = Factory.CreateClient();

        ScaffoldResponse? scaffold = await client.GetFromJsonAsync<ScaffoldResponse>(
            "/api/scaffolds/scaffold-parity-ladder");

        await Assert.That(scaffold is not null).IsTrue();
        await Assert.That(scaffold!.Phases.Count).IsEqualTo(5);
        await Assert.That(scaffold.Phases.SelectMany(phase => phase.Steps).Count())
            .IsEqualTo(12);

        ScaffoldStepResponse knownStep = FindStep(
            scaffold,
            "step-join-known-quantities");
        ScaffoldStepResponse unknownStep = FindStep(
            scaffold,
            "step-join-unknown-quantities");
        QuantityJoinSceneResponse known = QuantityJoinSceneFor(knownStep);
        QuantityJoinSceneResponse unknown = QuantityJoinSceneFor(unknownStep);

        await Assert.That(known.Parts)
            .IsEquivalentTo(unknown.Parts);
        await Assert.That(known.Bindings.Single().SemanticEntityId)
            .IsEqualTo("entity-n");
        await Assert.That(known.Bindings.Single().Value)
            .IsEqualTo(15);
        await Assert.That(known.ShowSizedTarget).IsTrue();
        await Assert.That(unknown.Bindings.Count).IsEqualTo(0);
        await Assert.That(unknown.ShowSizedTarget).IsFalse();

        ScaffoldStepResponse countStep = FindStep(scaffold, "step-count-base-parts");
        ScaffoldStepResponse lengthStep = FindStep(scaffold, "step-measure-remainder");
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
        scaffold.Phases
            .SelectMany(phase => phase.Steps)
            .Single(step => step.Id == id);

    private static QuantityJoinSceneResponse QuantityJoinSceneFor(
        ScaffoldStepResponse step)
    {
        FreshSceneResponse fresh = step.Scene as FreshSceneResponse ??
            throw new InvalidOperationException("Expected a fresh scene.");

        return fresh.Definition as QuantityJoinSceneResponse ??
            throw new InvalidOperationException("Expected a quantity-join scene.");
    }
}
