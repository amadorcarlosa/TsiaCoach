using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Coaching;

/// <summary>
/// Any step on the scaffold's ordered path is a valid landing point. The
/// resolver only confirms the authored id exists; it never searches.
/// </summary>
public static class ScaffoldEntryResolver
{
    public static ScaffoldEntry Resolve(
        Scaffold scaffold,
        ScaffoldStepId entryStepId)
    {
        if (!scaffold.ContainsStep(entryStepId))
        {
            throw new InvalidOperationException(
                $"Scaffold '{scaffold.Id.Value}' has no step '{entryStepId.Value}'.");
        }

        return new ScaffoldEntry(scaffold.Id, entryStepId);
    }

    public static ScaffoldEntry Floor(Scaffold scaffold) =>
        new(scaffold.Id, scaffold.FloorStep.Id);
}
