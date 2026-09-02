using System.Text;
using System.Text.Json;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.CoachingAgents;

/// <summary>
/// Treats model output as untrusted input. Exactly one JSON object, a move
/// from the phase allow-list, ids from the authorized sets only. A
/// <c>routeToStep</c> or <c>answerQuestion</c> reply carries a bare shape id;
/// the student-facing step and message come from the authored resolution,
/// never from the model.
/// </summary>
public static class CoachTurnValidator
{
    public const int MaxMessageLength = 600;

    private static readonly ISet<string> MessageMoveProperties =
        new HashSet<string>(StringComparer.Ordinal)
        {
            "move",
            "message",
            "focusPhraseIds",
            "suggestedStepId",
            "provenanceFactIds"
        };

    private static readonly ISet<string> RouteMoveProperties =
        new HashSet<string>(StringComparer.Ordinal)
        {
            "move",
            "shapeId"
        };

    public static CoachTurnValidationResult Validate(
        string modelText,
        CoachingAgentDefinition definition)
    {
        using JsonDocument? document = ParseSingleJsonObject(modelText);
        if (document is null)
        {
            return CoachTurnValidationResult.Invalid("malformedJson");
        }

        JsonElement root = document.RootElement;

        if (!TryReadString(root, "move", out string? move) ||
            !definition.AllowedMoves.Contains(move))
        {
            return CoachTurnValidationResult.Invalid("moveMissingOrNotAllowed");
        }

        return move switch
        {
            CoachContractNames.RouteToStep => ValidateRouteToStep(root, definition),
            CoachContractNames.AnswerQuestion => ValidateAnswerQuestion(root, definition),
            _ => ValidateMessageMove(root, move, definition)
        };
    }

    private static CoachTurnValidationResult ValidateAnswerQuestion(
        JsonElement root,
        CoachingAgentDefinition definition)
    {
        if (!HasOnlyProperties(root, RouteMoveProperties))
        {
            return CoachTurnValidationResult.Invalid("unexpectedProperty");
        }

        if (!TryReadString(root, "shapeId", out string? shapeId) ||
            definition.AuthorizedQuestionShapes is null ||
            !definition.AuthorizedQuestionShapes.TryGetValue(shapeId, out QuestionShapeResolution? resolution))
        {
            return CoachTurnValidationResult.Invalid("unauthorizedQuestionShapeId");
        }

        return CoachTurnValidationResult.Valid(
            new CoachTurnResponse(
                new AnswerQuestionResponse(
                    resolution.Message,
                    resolution.FocusPhraseIds,
                    resolution.StepId)));
    }

    private static CoachTurnValidationResult ValidateRouteToStep(
        JsonElement root,
        CoachingAgentDefinition definition)
    {
        if (!HasOnlyProperties(root, RouteMoveProperties))
        {
            return CoachTurnValidationResult.Invalid("unexpectedProperty");
        }

        if (!TryReadString(root, "shapeId", out string? shapeId) ||
            definition.AuthorizedProbeShapes is null ||
            !definition.AuthorizedProbeShapes.TryGetValue(shapeId, out ProbeShapeResolution? resolution))
        {
            return CoachTurnValidationResult.Invalid("unauthorizedProbeShapeId");
        }

        return CoachTurnValidationResult.Valid(
            new CoachTurnResponse(
                new RouteToStepResponse(
                    resolution.Message,
                    resolution.FocusPhraseIds,
                    resolution.StepId)),
            resolvedProbeShapeId: shapeId);
    }

    private static CoachTurnValidationResult ValidateMessageMove(
        JsonElement root,
        string move,
        CoachingAgentDefinition definition)
    {
        if (!HasOnlyProperties(root, MessageMoveProperties))
        {
            return CoachTurnValidationResult.Invalid("unexpectedProperty");
        }

        if (!TryReadString(root, "message", out string? message) ||
            string.IsNullOrWhiteSpace(message) ||
            message.Length > MaxMessageLength)
        {
            return CoachTurnValidationResult.Invalid("invalidMessage");
        }

        if (!TryReadStringArray(root, "focusPhraseIds", out string[] focusPhraseIds) ||
            focusPhraseIds.Any(id => !definition.AuthorizedFocusPhraseIds.Contains(id)))
        {
            return CoachTurnValidationResult.Invalid("invalidFocusPhraseIds");
        }

        if (!TryReadOptionalString(root, "suggestedStepId", out string? suggestedStepId))
        {
            return CoachTurnValidationResult.Invalid("invalidSuggestedStepId");
        }

        if (!TryReadStringArray(root, "provenanceFactIds", out string[] provenanceFactIds))
        {
            return CoachTurnValidationResult.Invalid("invalidProvenanceFactIds");
        }

        if (move != CoachContractNames.SuggestScaffold &&
            suggestedStepId is not null)
        {
            return CoachTurnValidationResult.Invalid("unexpectedSuggestedStepId");
        }

        if (move == CoachContractNames.SuggestScaffold &&
            (string.IsNullOrWhiteSpace(suggestedStepId) ||
             definition.AuthorizedSuggestedStepId is null ||
             !string.Equals(
                 suggestedStepId,
                 definition.AuthorizedSuggestedStepId,
                 StringComparison.Ordinal)))
        {
            return CoachTurnValidationResult.Invalid("unauthorizedSuggestedStepId");
        }

        if (move != CoachContractNames.ExplainWhy &&
            provenanceFactIds.Length > 0)
        {
            return CoachTurnValidationResult.Invalid("unexpectedProvenanceFactIds");
        }

        if (move == CoachContractNames.ExplainWhy &&
            provenanceFactIds.Any(id => !definition.AuthorizedProvenanceFactIds.Contains(id)))
        {
            return CoachTurnValidationResult.Invalid("unauthorizedProvenanceFactIds");
        }

        CoachMoveResponse responseMove = move switch
        {
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

    private static bool HasOnlyProperties(JsonElement root, ISet<string> expected)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (JsonProperty property in root.EnumerateObject())
        {
            if (!expected.Contains(property.Name) ||
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
    CoachTurnResponse? Response,
    string? FailureReason,
    string? ResolvedProbeShapeId = null)
{
    public static CoachTurnValidationResult Valid(
        CoachTurnResponse response,
        string? resolvedProbeShapeId = null) =>
        new(true, response, null, resolvedProbeShapeId);

    public static CoachTurnValidationResult Invalid(
        string failureReason = "unknown") =>
        new(false, null, failureReason);
}
