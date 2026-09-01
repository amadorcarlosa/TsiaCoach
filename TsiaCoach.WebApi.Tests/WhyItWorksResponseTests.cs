using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.WebApi.Attempts;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Tests;

public sealed class WhyItWorksResponseTests
{
    [Test]
    public async Task WhyItWorks_RejectsBeforeCheck()
    {
        Attempt attempt = Attempt.Start(new("before"), PracticeItemTwo.Item);

        await AssertRejects(() => WhyItWorksProjector.Project(attempt, PracticeItemTwo.Item));
    }

    [Test]
    public async Task WhyItWorks_RejectsIncorrectAttempt()
    {
        Attempt attempt = IncorrectAttempt();

        await AssertRejects(() => WhyItWorksProjector.Project(attempt, PracticeItemTwo.Item));
    }

    [Test]
    public async Task WhyItWorks_AfterCorrectReturnsTransitiveProvenance()
    {
        WhyItWorksResponse response = WhyItWorksProjector.Project(
            CorrectItemOneAttempt(), PracticeItemOne.Item);

        string[] ids = response.ProvenanceChain.Select(fact => fact switch
        {
            DerivedScalarResponse scalar => scalar.Id,
            DerivedExpressionResponse expression => expression.Id,
            _ => throw new InvalidOperationException()
        }).ToArray();
        string[] expected =
        [
            "latent-ordered-step",
            "latent-second-member",
            "latent-requested-value-composed",
            "latent-like-term-count",
            "latent-requested-value-simplified"
        ];

        await Assert.That(ids.SequenceEqual(expected)).IsTrue();
        await Assert.That(ids[^1]).IsEqualTo("latent-requested-value-simplified");
    }

    [Test]
    public async Task WhyItWorks_PreservesCheckCountForReflection()
    {
        WhyItWorksResponse firstTry = WhyItWorksProjector.Project(
            CorrectAttempt(), PracticeItemTwo.Item);
        WhyItWorksResponse afterHelp = WhyItWorksProjector.Project(
            CorrectAfterIncorrectAttempt(), PracticeItemTwo.Item);

        await Assert.That(firstTry.CheckCount).IsEqualTo(1);
        await Assert.That(afterHelp.CheckCount).IsEqualTo(2);
    }

    [Test]
    public async Task WhyItWorks_RequestedValueMatchesSelectedAnswer()
    {
        WhyItWorksResponse response = WhyItWorksProjector.Project(
            CorrectAttempt(), PracticeItemTwo.Item);
        DerivedExpressionResponse requested = response.ProvenanceChain
            .OfType<DerivedExpressionResponse>()
            .Single(fact => fact.Meaning == "requestedValueSimplified");

        await Assert.That(response.SelectedAnswerId).IsEqualTo("answer-d");
        await Assert.That(requested.MathObjectId).IsEqualTo("math-answer-d");
    }

    private static Attempt CorrectAttempt() => Attempt.Start(
            new("why-it-works"), PracticeItemTwo.Item)
        .Append(new("check-1"), new("answer-d"), Timestamp(1), PracticeItemTwo.Item);

    private static Attempt CorrectItemOneAttempt() => Attempt.Start(
            new("why-it-works-item-one"), PracticeItemOne.Item)
        .Append(new("check-1"), new("answer-d"), Timestamp(1), PracticeItemOne.Item);

    private static Attempt IncorrectAttempt() => Attempt.Start(
            new("why-it-works-incorrect"), PracticeItemTwo.Item)
        .Append(new("check-1"), new("answer-a"), Timestamp(1), PracticeItemTwo.Item);

    private static Attempt CorrectAfterIncorrectAttempt() => IncorrectAttempt()
        .Append(new("check-2"), new("answer-d"), Timestamp(2), PracticeItemTwo.Item);

    private static DateTimeOffset Timestamp(int seconds) =>
        new(2026, 1, 1, 0, 0, seconds, TimeSpan.Zero);

    private static async Task AssertRejects(Func<WhyItWorksResponse> action)
    {
        InvalidOperationException? exception = null;
        try
        {
            _ = action();
        }
        catch (InvalidOperationException caught)
        {
            exception = caught;
        }

        await Assert.That(exception is not null).IsTrue();
    }
}
