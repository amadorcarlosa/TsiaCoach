using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

public sealed class PracticeItemPromptEndpointTests : ApiTestBase
{
    [Test]
    public async Task PromptList_ReturnsBothPracticeItems()
    {
        using HttpClient client = Factory.CreateClient();
        using HttpResponseMessage response = await client.GetAsync("/api/practice-items");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
        PracticeItemPromptResponse[]? items =
            await response.Content.ReadFromJsonAsync<PracticeItemPromptResponse[]>();

        await Assert.That(items is not null).IsTrue();
        await Assert.That(items!.Select(item => item.Id))
            .IsEquivalentTo(["practice-item-sample-1", "practice-item-sample-2"]);
    }

    [Test]
    public async Task PromptById_PreservesTextAnswersMathEntitiesAndEdges()
    {
        using HttpClient client = Factory.CreateClient();
        PracticeItemPromptResponse? item = await client.GetFromJsonAsync<PracticeItemPromptResponse>(
            "/api/practice-items/practice-item-sample-1");

        await Assert.That(item is not null).IsTrue();
        await Assert.That(item!.Text.Tokens.Count).IsEqualTo(45);
        await Assert.That(item.Interaction.Answers.Count).IsEqualTo(4);
        await Assert.That(item.Interaction.AnswerMathBindings.Single(
                binding => binding.AnswerChoiceId == "answer-d").MathObjectId)
            .IsEqualTo("math-answer-d");
        await Assert.That(item.Mathematics.Objects.Any(
                mathObject => mathObject.Id == "math-answer-d"))
            .IsTrue();
        await Assert.That(item.Semantics.Entities.Count).IsGreaterThan(0);
        await Assert.That(item.Semantics.Edges.Count).IsGreaterThan(0);
    }

    [Test]
    public async Task PromptJson_DoesNotContainCorrectAnswerId()
        => await AssertPromptOmits("correctAnswerId");

    [Test]
    public async Task PromptJson_DoesNotContainLatentFacts()
        => await AssertPromptOmits("latentFacts");

    [Test]
    public async Task PromptJson_DoesNotContainMisconceptionCodes()
        => await AssertPromptOmits("misconceptionCode");

    [Test]
    public async Task UnknownPracticeItem_ReturnsNotFound()
    {
        using HttpClient client = Factory.CreateClient();
        using HttpResponseMessage response = await client.GetAsync(
            "/api/practice-items/does-not-exist");

        await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
        await Assert.That(response.Content.Headers.ContentType?.MediaType)
            .IsEqualTo("application/problem+json");
    }

    private async Task AssertPromptOmits(string propertyName)
    {
        using HttpClient client = Factory.CreateClient();
        using HttpResponseMessage response = await client.GetAsync("/api/practice-items");
        using JsonDocument json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        await Assert.That(ContainsProperty(json.RootElement, propertyName)).IsFalse();
    }

    private static bool ContainsProperty(JsonElement element, string propertyName)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (JsonProperty property in element.EnumerateObject())
            {
                if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase) ||
                    ContainsProperty(property.Value, propertyName))
                {
                    return true;
                }
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            return element.EnumerateArray().Any(value => ContainsProperty(value, propertyName));
        }

        return false;
    }
}
