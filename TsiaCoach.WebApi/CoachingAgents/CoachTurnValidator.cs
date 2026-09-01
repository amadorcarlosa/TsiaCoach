using System.Text;
using System.Text.Json;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.CoachingAgents;

public static class CoachTurnValidator
{
    public const int MaxMessageLength = 600;

    private static readonly ISet<string> ExpectedProperties =
        new HashSet<string>(StringComparer.Ordinal)
        {
            "move",
            "message",
            "focusPhraseIds",
            "suggestedStepId",
            "provenanceFactIds"
        };

    public static CoachTurnValidationResult Validate(
        string modelText,
        CoachingAgentDefinition definition)
    {
        using JsonDocument? document = ParseSingleJsonObject(modelText);
        if (document is null)
        {
            return CoachTurnValidationResult.Invalid();
        }

        JsonElement root = document.RootElement;
        if (!HasOnlyExpectedProperties(root))
        {
            return CoachTurnValidationResult.Invalid();
        }

        if (!TryReadString(root, "move", out string? move) ||
            !definition.AllowedMoves.Contains(move))
        {
            return CoachTurnValidationResult.Invalid();
        }

        if (!TryReadString(root, "message", out string? message) ||
            string.IsNullOrWhiteSpace(message) ||
            message.Length > MaxMessageLength)
        {
            return CoachTurnValidationResult.Invalid();
        }

        if (!TryReadStringArray(root, "focusPhraseIds", out string[] focusPhraseIds) ||
            focusPhraseIds.Any(id => !definition.AuthorizedFocusPhraseIds.Contains(id)))
        {
            return CoachTurnValidationResult.Invalid();
        }

        if (!TryReadOptionalString(root, "suggestedStepId", out string? suggestedStepId))
        {
            return CoachTurnValidationResult.Invalid();
        }

        if (!TryReadStringArray(root, "provenanceFactIds", out string[] provenanceFactIds))
        {
            return CoachTurnValidationResult.Invalid();
        }

        if (move != CoachContractNames.SuggestScaffold &&
            suggestedStepId is not null)
        {
            return CoachTurnValidationResult.Invalid();
        }

        if (move == CoachContractNames.SuggestScaffold &&
            (string.IsNullOrWhiteSpace(suggestedStepId) ||
             definition.AuthorizedSuggestedStepId is null ||
             !string.Equals(
                 suggestedStepId,
                 definition.AuthorizedSuggestedStepId,
                 StringComparison.Ordinal)))
        {
            return CoachTurnValidationResult.Invalid();
        }

        if (move != CoachContractNames.ExplainWhy &&
            provenanceFactIds.Length > 0)
        {
            return CoachTurnValidationResult.Invalid();
        }

        if (move == CoachContractNames.ExplainWhy &&
            provenanceFactIds.Any(id => !definition.AuthorizedProvenanceFactIds.Contains(id)))
        {
            return CoachTurnValidationResult.Invalid();
        }

        CoachMoveResponse responseMove = move switch
        {
            CoachContractNames.AskReadingQuestion =>
                new AskReadingQuestionResponse(message, focusPhraseIds),
            CoachContractNames.DiagnoseDifference =>
                new DiagnoseDifferenceResponse(message, focusPhraseIds),
            CoachContractNames.SuggestScaffold =>
                new SuggestScaffoldResponse(
                    message,
                    focusPhraseIds,
                    suggestedStepId!),
            CoachContractNames.ExplainWhy =>
                new ExplainWhyResponse(
                    message,
                    focusPhraseIds,
                    provenanceFactIds),
            _ => throw new InvalidOperationException(
                $"Unsupported coach move '{move}'.")
        };

        return CoachTurnValidationResult.Valid(
            new CoachTurnResponse(responseMove));
    }

    private static JsonDocument? ParseSingleJsonObject(string text)
    {
        try
        {
            byte[] utf8 = Encoding.UTF8.GetBytes(text);
            var reader = new Utf8JsonReader(
                utf8,
                isFinalBlock: true,
                state: default);
            JsonDocument document = JsonDocument.ParseValue(ref reader);

            for (int index = checked((int)reader.BytesConsumed);
                 index < utf8.Length;
                 index++)
            {
                if (!char.IsWhiteSpace((char)utf8[index]))
                {
                    document.Dispose();
                    return null;
                }
            }

            return document.RootElement.ValueKind == JsonValueKind.Object
                ? document
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static bool HasOnlyExpectedProperties(JsonElement root)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (JsonProperty property in root.EnumerateObject())
        {
            if (!ExpectedProperties.Contains(property.Name) ||
                !seen.Add(property.Name))
            {
                return false;
            }
        }

        return true;
    }

    private static bool TryReadString(
        JsonElement root,
        string propertyName,
        out string value)
    {
        value = string.Empty;
        if (!root.TryGetProperty(propertyName, out JsonElement property) ||
            property.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        value = property.GetString() ?? string.Empty;
        return true;
    }

    private static bool TryReadOptionalString(
        JsonElement root,
        string propertyName,
        out string? value)
    {
        value = null;
        if (!root.TryGetProperty(propertyName, out JsonElement property) ||
            property.ValueKind == JsonValueKind.Null)
        {
            return true;
        }

        if (property.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        value = property.GetString();
        return true;
    }

    private static bool TryReadStringArray(
        JsonElement root,
        string propertyName,
        out string[] values)
    {
        values = [];
        if (!root.TryGetProperty(propertyName, out JsonElement property))
        {
            return true;
        }

        if (property.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        var list = new List<string>();
        foreach (JsonElement item in property.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.String)
            {
                return false;
            }

            list.Add(item.GetString() ?? string.Empty);
        }

        values = list.ToArray();
        return true;
    }
}

public sealed record CoachTurnValidationResult(
    bool IsValid,
    CoachTurnResponse? Response)
{
    public static CoachTurnValidationResult Valid(
        CoachTurnResponse response) =>
        new(true, response);

    public static CoachTurnValidationResult Invalid() =>
        new(false, null);
}
