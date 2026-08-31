using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.AI;

namespace TsiaCoach.WebApi.Request;

public enum AgentRole
{
    [JsonStringEnumMemberName("user")]
    User,

    [JsonStringEnumMemberName("assistant")]
    Assistant
}


public record UserMessage(string Message)
{
    [JsonRequired]
    public AgentRole Role { get; init; } = AgentRole.User;
}

public record ModelMessage(string Message, string Model)
{
    [JsonRequired]
    public AgentRole Role { get; init; } = AgentRole.Assistant;
}

[JsonUnion(TypeClassifier = typeof(TurnDtoClassifier))]
public union TurnDto(UserMessage, ModelMessage);

public sealed class TurnDtoClassifier : JsonTypeClassifierFactory<TurnDto>
{
    public override JsonTypeClassifier CreateJsonClassifier(
        JsonTypeClassifierContext context,
        JsonSerializerOptions options)
    {
        return static (ref Utf8JsonReader reader) =>
        {
            if (reader.TokenType is not JsonTokenType.StartObject)
                return null;

            while (reader.Read() && reader.TokenType is not JsonTokenType.EndObject)
            {
                if (reader.TokenType is not JsonTokenType.PropertyName)
                    continue;

                if (reader.ValueTextEquals("role"u8))
                {
                    reader.Read();

                    return reader.GetString() switch
                    {
                        "user" => typeof(UserMessage),
                        "assistant" => typeof(ModelMessage),
                        _ => null
                    };
                }

                reader.Read();
                reader.Skip();
            }

            return null;
        };
    }
}
public sealed record AgentRequest(
    string Model,
    string Instructions,
    string Prompt,
    IReadOnlyList<TurnDto> History);
internal static class AgentRequestExtensions
{
    public static ChatMessage ToChatMessage(this TurnDto turn) =>
        turn switch
        {
            UserMessage user =>
                new ChatMessage(
                    ChatRole.User,
                    user.Message),

            ModelMessage assistant =>
                new ChatMessage(
                    ChatRole.Assistant,
                    assistant.Message)
        };

    public static IReadOnlyList<ChatMessage> ToChatMessages(
        this AgentRequest request)
    {
        List<ChatMessage> messages =
            request.History
                .Select(static turn => turn.ToChatMessage())
                .ToList();

        messages.Add(
            new ChatMessage(
                ChatRole.User,
                request.Prompt));

        return messages;
    }
}    