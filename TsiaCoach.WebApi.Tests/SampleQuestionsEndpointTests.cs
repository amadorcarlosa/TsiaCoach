using System.Net;
using System.Net.Http.Json;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.Text;
using TsiaCoach.Domain.ValueObjects;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

public sealed class SampleQuestionsEndpointTests : ApiTestBase
{
    [Test]
    public async Task List_ReturnsQuestionsOneAndTwoWithMappedSemantics()
    {
        using HttpClient client = Factory.CreateClient();

        using HttpResponseMessage response =
            await client.GetAsync("/api/sample-questions");

        await Assert.That(response.StatusCode)
            .IsEqualTo(HttpStatusCode.OK);

        PracticeItemResponse[]? items =
            await response.Content.ReadFromJsonAsync<PracticeItemResponse[]>();

        await Assert.That(items is not null).IsTrue();
        await Assert.That(items!.Length).IsEqualTo(2);

        PracticeItemResponse questionOne = items.Single(item =>
            item.Id == "practice-item-sample-1");

        PracticeItemResponse questionTwo = items.Single(item =>
            item.Id == "practice-item-sample-2");

        await Assert.That(questionOne.Text.Tokens.Count).IsEqualTo(45);
        await Assert.That(questionOne.CorrectAnswerId).IsEqualTo("answer-d");
        await Assert.That(questionOne.Semantics.Entities
                .OfType<OrderedSetResponse>()
                .Single()
                .Domain)
            .IsEqualTo("oddIntegers");

        await Assert.That(questionTwo.Text.Tokens.Count).IsEqualTo(86);
        await Assert.That(questionTwo.CorrectAnswerId).IsEqualTo("answer-d");
        await Assert.That(questionTwo.Semantics.Entities
                .OfType<DerivedQuantityResponse>()
                .Count())
            .IsEqualTo(2);
    }

    [Test]
    public async Task QuestionTwo_PreservesAuthoredDerivationBuildOrder()
    {
        using HttpClient client = Factory.CreateClient();

        PracticeItemResponse? item = await client.GetFromJsonAsync<PracticeItemResponse>(
            "/api/sample-questions/practice-item-sample-2");

        await Assert.That(item is not null).IsTrue();

        DerivesFromResponse thisYear = item!.Semantics.Edges
            .OfType<DerivesFromResponse>()
            .Single(edge => edge.TargetEntityId == "entity-this-year");

        await Assert.That(thisYear.OperationsInBuildOrder.Count).IsEqualTo(2);
        await Assert.That(thisYear.OperationsInBuildOrder[0] is ScaleByResponse)
            .IsTrue();
        await Assert.That(thisYear.OperationsInBuildOrder[1] is IncrementByResponse)
            .IsTrue();
    }

    [Test]
    public async Task QuestionOne_ExposesExactTextAndAddressableMathBindings()
    {
        using HttpClient client = Factory.CreateClient();

        PracticeItemResponse? item = await client.GetFromJsonAsync<PracticeItemResponse>(
            "/api/sample-questions/practice-item-sample-1");

        await Assert.That(item is not null).IsTrue();
        await Assert.That(item!.Text.SourceText).IsEqualTo(PracticeItemOne.SourceText);

        AnswerChoiceResponse answer = item.Answers.Single(candidate =>
            candidate.Id == "answer-d");

        await Assert.That(Slice(item.Text.SourceText, answer.LabelCharacterSpan))
            .IsEqualTo("D.");
        await Assert.That(Slice(item.Text.SourceText, answer.ContentCharacterSpan))
            .IsEqualTo("2n + 2");

        MathTextBindingResponse objectBinding = item.Mathematics.TextBindings
            .Single(binding =>
                binding.MathObjectId == "math-answer-d" &&
                binding.MathNodeId is null);
        MathTextBindingResponse additionBinding = item.Mathematics.TextBindings
            .Single(binding =>
                binding.MathNodeId == "math-answer-d-addition");

        await Assert.That(Slice(item.Text.SourceText, objectBinding.CharacterSpan))
            .IsEqualTo("2n + 2");
        await Assert.That(Slice(item.Text.SourceText, additionBinding.CharacterSpan))
            .IsEqualTo(" + ");
        await Assert.That(item.AnswerMathBindings.Single(binding =>
                binding.AnswerChoiceId == "answer-d").MathObjectId)
            .IsEqualTo("math-answer-d");
        await Assert.That(item.Semantics.LatentFacts
                .OfType<DerivedExpressionResponse>()
                .Single(fact => fact.Meaning == "requestedValueSimplified")
                .MathObjectId)
            .IsEqualTo("math-answer-d");
    }

    [Test]
    public async Task UnknownQuestion_ReturnsNotFound()
    {
        using HttpClient client = Factory.CreateClient();

        using HttpResponseMessage response = await client.GetAsync(
            "/api/sample-questions/does-not-exist");

        await Assert.That(response.StatusCode)
            .IsEqualTo(HttpStatusCode.NotFound);
    }

    [Test]
    public async Task DomainSpans_ResolveTheAuthoredPhrasesAndAnswers()
    {
        string[] orderedStep = Resolve(
            PracticeItemOne.TextTokens,
            PracticeItemOne.Phrases.Single(phrase =>
                phrase.Id.Value == "phrase-ordered-step").Span);

        string[] questionTwoAnswer = Resolve(
            PracticeItemTwo.TextTokens,
            PracticeItemTwo.Answers.Single(answer =>
                answer.Id.Value == "answer-d").ContentSpan);

        await Assert.That(orderedStep)
            .IsEquivalentTo(["consecutive", "odd", "integers"]);
        await Assert.That(questionTwoAnswer)
            .IsEquivalentTo(["4", "w", "+", "6"]);
    }

    private static string[] Resolve(
        IReadOnlyList<TextToken> tokens,
        TokenSpan span) =>
        tokens
            .Skip(span.Start.Value)
            .Take(span.Length)
            .Select(token => token.Surface)
            .ToArray();

    private static string Slice(
        string sourceText,
        CharacterSpanResponse span) =>
        sourceText.Substring(span.Start, span.Length);
}
