using TsiaCoach.WebApi.Request;
using Microsoft.Extensions.AI;

namespace TsiaCoach.WebApi.Tests;

public sealed class AgentRequestTranslationTests
{
    [Test]
    public async Task ToChatMessages_ReplaysHistory_ThenAppendsPrompt()
    {
        var request = new AgentRequest(
            Model: "gpt-5.4-mini",
            Instructions: "Be concise.",
            Prompt: "current prompt",
            History:
            [
                new TurnDto(
                    new UserMessage("previous question")),

                new TurnDto(
                    new ModelMessage(
                        "previous answer",
                        "gpt-5.4-mini"))
            ]);

        IReadOnlyList<ChatMessage> messages =
            request.ToChatMessages();

        await Assert.That(messages.Count).IsEqualTo(3);

        await Assert.That(messages[0].Role)
            .IsEqualTo(ChatRole.User);
        await Assert.That(messages[0].Text)
            .IsEqualTo("previous question");

        await Assert.That(messages[1].Role)
            .IsEqualTo(ChatRole.Assistant);
        await Assert.That(messages[1].Text)
            .IsEqualTo("previous answer");

        await Assert.That(messages[2].Role)
            .IsEqualTo(ChatRole.User);
        await Assert.That(messages[2].Text)
            .IsEqualTo("current prompt");
    }
}