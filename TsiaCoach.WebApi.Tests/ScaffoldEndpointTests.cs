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
    public async Task Detail_ExposesOneFlatPathWithPurposeLabelsAndSideSteps()
    {
        using HttpClient client = Factory.CreateClient();

        ScaffoldResponse? scaffold = await client.GetFromJsonAsync<ScaffoldResponse>(
            "/api/scaffolds/scaffold-parity-ladder");

        await Assert.That(scaffold is not null).IsTrue();
        await Assert.That(scaffold!.Steps.Select(step => step.Id))
            .IsEquivalentTo(
            [
                "step-rebuild-from-twos-and-ones",
                "step-contrast-pair",
                "step-mark-the-whites",
                "step-sort-paired-evens",
                "step-select-consecutive-odds",
                "step-fill-the-gap",
                "step-name-the-smaller",
                "step-join-and-read-sum",
                "step-name-bar-count",
                "step-name-leftover-length"
            ]);
        await Assert.That(scaffold.Steps[0].Purpose).IsEqualTo("conceptFormation");
        await Assert.That(scaffold.Steps[0].EntryOnly).IsFalse();
        await Assert.That(FindStep(scaffold, "step-contrast-pair").EntryOnly).IsTrue();
        await Assert.That(FindStep(scaffold, "step-mark-the-whites").EntryOnly).IsTrue();
        await Assert.That(scaffold.Steps[^1].Purpose).IsEqualTo("generalization");
    }

    [Test]
    public async Task Detail_ExposesGridScenesAndTheirMoves()
    {
        using HttpClient client = Factory.CreateClient();

        ScaffoldResponse? scaffold = await client.GetFromJsonAsync<ScaffoldResponse>(
            "/api/scaffolds/scaffold-parity-ladder");

        ScaffoldStepResponse rebuild = FindStep(scaffold!, "step-rebuild-from-twos-and-ones");
        GridSceneResponse staircase = rebuild.Scene as GridSceneResponse ??
            throw new InvalidOperationException("Expected a grid scene.");
        PlacePiecesActionResponse place = rebuild.Action as PlacePiecesActionResponse ??
            throw new InvalidOperationException("Expected a place-pieces action.");

        await Assert.That(staircase.Reference.Count).IsEqualTo(10);
        await Assert.That(staircase.Reference.All(piece => piece.Kind == "rod")).IsTrue();
        await Assert.That(staircase.TargetRows.Count).IsEqualTo(10);
        await Assert.That(staircase.UnitLines).IsTrue();
        await Assert.That(place.AllowedLengths).IsEquivalentTo(new[] { 2, 1 });

        ScaffoldStepResponse sort = FindStep(scaffold, "step-sort-paired-evens");
        MoveRowsActionResponse move = sort.Action as MoveRowsActionResponse ??
            throw new InvalidOperationException("Expected a move-rows action.");
        MatchesRowPartitionCheckResponse partition = sort.SuccessCheck as MatchesRowPartitionCheckResponse ??
            throw new InvalidOperationException("Expected a row-partition check.");
        await Assert.That(move.CompareColumn).IsEqualTo(12);
        await Assert.That(partition.ExpectedMovedRows).IsEquivalentTo(new[] { 2, 4, 6, 8, 10 });

        ScaffoldStepResponse consecutive = FindStep(scaffold, "step-select-consecutive-odds");
        MatchesRowSelectionCheckResponse selection = consecutive.SuccessCheck as MatchesRowSelectionCheckResponse ??
            throw new InvalidOperationException("Expected a row-selection check.");
        await Assert.That(consecutive.Action).IsTypeOf<SelectRowsActionResponse>();
        await Assert.That(selection.Rule).IsEqualTo("adjacentInList");
        await Assert.That(selection.RequiredCount).IsEqualTo(2);
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
