using System.Text.Json;
using TsiaCoach.Domain.Manipulatives;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.SampleScaffolds;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.ValueObjects;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

public sealed class BaseTenBlockResourceTests
{
    [Test]
    public void Validator_AcceptsEveryBlockDenominationAlongsideRodResources()
    {
        foreach (Base10Denomination denomination in Enum.GetValues<Base10Denomination>())
        {
            ScaffoldValidator.Validate(WithBlock(denomination), PracticeItemOne.Item);
        }
    }

    [Test]
    public async Task Validator_RejectsUnknownDenomination()
    {
        await Assert.That(() => ScaffoldValidator.Validate(
            WithBlock((Base10Denomination)2), PracticeItemOne.Item))
            .Throws<InvalidOperationException>();
    }

    [Test]
    public async Task Block_SerializesOnAuthoringAndLearnerPaths()
    {
        ScaffoldResource block = new BaseTenBlockResource(
            new ScaffoldResourceId("tens"), Base10Denomination.Tens, ResourceMultiplicity.Repeatable);
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        string authoring = JsonSerializer.Serialize(
            ScaffoldResponseMapper.ToResourceResponse(block), options);
        string learner = JsonSerializer.Serialize(
            ScaffoldResponseMapper.ToLearnerResourceResponse(block, PracticeItemOne.Item), options);

        await Assert.That(learner).IsEqualTo(authoring);
        using JsonDocument json = JsonDocument.Parse(authoring);
        await Assert.That(json.RootElement.GetProperty("type").GetString()).IsEqualTo("baseTenBlockResource");
        await Assert.That(json.RootElement.GetProperty("id").GetString()).IsEqualTo("tens");
        await Assert.That(json.RootElement.GetProperty("denomination").GetString()).IsEqualTo("tens");
        await Assert.That(json.RootElement.GetProperty("multiplicity").GetString()).IsEqualTo("repeatable");
    }

    private static Scaffold WithBlock(Base10Denomination denomination)
    {
        Scaffold scaffold = ParityLadderScaffold.Definition;
        return scaffold with
        {
            Resources = [.. scaffold.Resources, new BaseTenBlockResource(
                new ScaffoldResourceId("block"), denomination, ResourceMultiplicity.Repeatable)]
        };
    }
}
