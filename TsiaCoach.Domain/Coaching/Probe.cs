using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Coaching;

public readonly record struct ProbeShapeId(string Value);

/// <summary>
/// One authored shape a student's probe answer can take, and where on the
/// path that shape lands. The description is what the classifier reads; the
/// route message is what the student reads. The agent writes neither.
/// </summary>
public sealed record ProbeAnswerShape(
    ProbeShapeId Id,
    string Description,
    ScaffoldStepId EntryStepId,
    string RouteMessage);

/// <summary>
/// The authored diagnostic question asked when a student requests help before
/// a check. Answer shapes map to step ids; the agent's whole job is to pick
/// one shape id from this list.
/// </summary>
public sealed record ProbeQuestion(
    string Text,
    IReadOnlyList<PhraseId> FocusPhraseIds,
    IReadOnlyList<ProbeAnswerShape> Shapes)
{
    public ProbeAnswerShape Shape(ProbeShapeId shapeId) =>
        Shapes.FirstOrDefault(shape => shape.Id == shapeId)
        ?? throw new InvalidOperationException(
            $"Probe has no answer shape '{shapeId.Value}'.");

    public bool ContainsShape(ProbeShapeId shapeId) =>
        Shapes.Any(shape => shape.Id == shapeId);
}

/// <summary>
/// A recorded fact: which authored shape a student's probe answer resolved
/// to, and the step it routed to. The answer text itself is not stored.
/// </summary>
public sealed record ProbeRoute(
    AttemptId AttemptId,
    ProbeShapeId ShapeId,
    ScaffoldStepId EntryStepId,
    DateTimeOffset RoutedAt);
