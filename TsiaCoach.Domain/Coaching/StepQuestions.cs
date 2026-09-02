using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Coaching;

public readonly record struct QuestionShapeId(string Value);

/// <summary>
/// One authored shape a student's question on a step can take, and the
/// authored reply for it. The description is what the classifier reads; the
/// reply is what the student reads. The agent writes neither, and a question
/// never moves the student.
/// </summary>
public sealed record QuestionShape(
    QuestionShapeId Id,
    string Description,
    string Reply);

/// <summary>The authored question shapes for one step of the path.</summary>
public sealed record StepQuestionSet(
    ScaffoldStepId StepId,
    IReadOnlyList<QuestionShape> Shapes)
{
    public QuestionShape Shape(QuestionShapeId shapeId) =>
        Shapes.FirstOrDefault(shape => shape.Id == shapeId)
        ?? throw new InvalidOperationException(
            $"Step '{StepId.Value}' has no question shape '{shapeId.Value}'.");

    public bool ContainsShape(QuestionShapeId shapeId) =>
        Shapes.Any(shape => shape.Id == shapeId);
}
