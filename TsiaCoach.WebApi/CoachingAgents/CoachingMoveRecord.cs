namespace TsiaCoach.WebApi.CoachingAgents;

/// <summary>
/// A server-derived diagnostic fact describing one validated coaching move.
/// Contains no model instructions, model context, raw or rejected model
/// output, correct answers, distractor tables, latent solution values,
/// scaffold success checks, or client conversation history.
/// </summary>
public sealed record CoachingMoveRecord(
    string RecordId,
    string AttemptId,
    string PracticeItemId,
    int CheckCount,
    string Phase,
    string RequestedEvent,
    string MoveKind,
    IReadOnlyList<string> FocusPhraseIds,
    string? SuggestedStepId,
    IReadOnlyList<string> ProvenanceFactIds,
    DateTimeOffset RecordedAt);
