using System.Collections.Frozen;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace TsiaCoach.WebApi.PlaygroundEvents;

/// <summary>
/// The C# counterpart of <c>shared/effect/playground-events.ts</c>: which event types
/// each playground may record and which data fields an event may carry. Keep the two in step.
/// </summary>
public static partial class PlaygroundEventSchema
{
    public const int MaxReasonLength = 64;
    public const int MaxListItems = 100;

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$")]
    public static partial Regex Token();

    /// <summary>A rejection code such as <c>select-exactly-n-x-rods</c>: lowercase words and hyphens only.</summary>
    [GeneratedRegex("^[a-z](?:[a-z-]{0,62}[a-z])?$")]
    public static partial Regex ReasonCode();

    private static readonly string[] RodTypes =
    [
        "piece.created", "piece.moved", "piece.deleted", "piece.duplicated",
        "rods.grouped", "rods.ungrouped", "regroup-ones", "regroup-addends", "regroup-factors",
        "regroup-area", "make-rectangle", "zero-pair.cancelled", "rotated",
        "material-role.changed", "board.transformed",
    ];

    private static readonly string[] SystemsTypes =
    [
        .. RodTypes,
        "arrange.x-then-y", "count.rod-added", "count.rod-removed",
        "denomination.converted", "system.correctness-evaluated",
        "conversion.started", "conversion.cancelled", "exchange.selected", "hint.requested",
    ];

    public static readonly FrozenDictionary<string, FrozenSet<string>> EventTypes =
        new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            ["bar-rod"] = RodTypes,
            ["array-rod"] = RodTypes,
            ["fraction-rod"] = RodTypes,
            ["math-tabla"] = RodTypes,
            ["rod-canvas"] = RodTypes,
            ["systems"] = SystemsTypes,
            ["rod-count-systems"] = SystemsTypes,
            ["base-ten"] =
            [
                "block.placed", "block.moved", "block.deleted", "block.rotated", "block.duplicated",
                "exchange.regrouped",
            ],
            ["algebra-tiles"] =
            [
                "tile.added", "tile.moved", "tile.rotated", "tile.duplicated", "tile.deleted",
                "tile.sign-flipped", "zero-pair.cancelled",
            ],
            ["scaffold"] = ["step.checked", "step.advanced", "coach.asked"],
        }.ToFrozenDictionary(
            pair => pair.Key,
            pair => pair.Value.ToFrozenSet(StringComparer.Ordinal),
            StringComparer.Ordinal);

    public static IEnumerable<string> Playgrounds => EventTypes.Keys;

    public static bool Records(string playground, string type) =>
        EventTypes.TryGetValue(playground, out FrozenSet<string>? types) && types.Contains(type);

    private enum Field { Tokens, Point, Integer, Integers, Count, Token, Sign, Shape, Boolean }

    private static readonly FrozenDictionary<string, Field> DataFields = new Dictionary<string, Field>(StringComparer.Ordinal)
    {
        ["pieceIds"] = Field.Tokens,
        ["createdIds"] = Field.Tokens,
        ["pieceKinds"] = Field.Tokens,
        ["delta"] = Field.Point,
        ["value"] = Field.Integer,
        ["values"] = Field.Integers,
        ["count"] = Field.Count,
        ["variant"] = Field.Token,
        ["term"] = Field.Token,
        ["sign"] = Field.Sign,
        ["denomination"] = Field.Token,
        ["pose"] = Field.Token,
        ["orientation"] = Field.Token,
        ["materialRole"] = Field.Token,
        ["shape"] = Field.Shape,
        ["satisfied"] = Field.Boolean,
        ["stepId"] = Field.Token,
        ["length"] = Field.Count,
    }.ToFrozenDictionary(StringComparer.Ordinal);

    /// <summary>True when <paramref name="data"/> is an object holding only allowlisted fields of the right shape.</summary>
    public static bool IsValidData(JsonElement data)
    {
        if (data.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        HashSet<string> seen = new(StringComparer.Ordinal);
        foreach (JsonProperty property in data.EnumerateObject())
        {
            if (!seen.Add(property.Name) ||
                !DataFields.TryGetValue(property.Name, out Field field) ||
                !Matches(property.Value, field))
            {
                return false;
            }
        }

        return true;
    }

    private static bool Matches(JsonElement value, Field field) => field switch
    {
        Field.Tokens => IsList(value, IsToken),
        Field.Integers => IsList(value, IsInteger),
        Field.Point => HasExactly(value, ("x", IsInteger), ("y", IsInteger)),
        Field.Shape => HasExactly(value, ("width", IsCount), ("depth", IsCount)),
        Field.Integer => IsInteger(value),
        Field.Count => IsCount(value),
        Field.Token => IsToken(value),
        Field.Sign => value.ValueKind == JsonValueKind.String && value.GetString() is "positive" or "negative",
        Field.Boolean => value.ValueKind is JsonValueKind.True or JsonValueKind.False,
        _ => false,
    };

    private static bool IsToken(JsonElement value) =>
        value.ValueKind == JsonValueKind.String && Token().IsMatch(value.GetString()!);

    // Mirrors Schema.isInt: whole numbers within JavaScript's safe range.
    private static bool IsInteger(JsonElement value) =>
        value.ValueKind == JsonValueKind.Number &&
        value.TryGetDouble(out double number) &&
        double.IsInteger(number) &&
        Math.Abs(number) <= 9_007_199_254_740_991;

    private static bool IsCount(JsonElement value) => IsInteger(value) && value.GetDouble() >= 0;

    private static bool IsList(JsonElement value, Func<JsonElement, bool> item) =>
        value.ValueKind == JsonValueKind.Array &&
        value.GetArrayLength() <= MaxListItems &&
        value.EnumerateArray().All(item);

    private static bool HasExactly(JsonElement value, params (string Name, Func<JsonElement, bool> Check)[] fields)
    {
        if (value.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        int count = 0;
        foreach (JsonProperty property in value.EnumerateObject())
        {
            count++;
            if (!fields.Any(field => field.Name == property.Name && field.Check(property.Value)))
            {
                return false;
            }
        }

        return count == fields.Length;
    }
}
