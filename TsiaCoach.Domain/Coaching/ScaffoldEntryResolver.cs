using TsiaCoach.Domain.Scaffolds;

namespace TsiaCoach.Domain.Coaching;

public static class ScaffoldEntryResolver
{
    public static ScaffoldEntry Resolve(
        Scaffold scaffold,
        ScaffoldPhasePurpose purpose)
    {
        ScaffoldPhase[] matchingPhases = scaffold.Phases
            .Where(phase => phase.Purpose == purpose)
            .ToArray();

        if (matchingPhases.Length != 1)
        {
            throw new InvalidOperationException(
                matchingPhases.Length == 0
                    ? $"Scaffold '{scaffold.Id.Value}' has no phase for purpose '{purpose}'."
                    : $"Scaffold '{scaffold.Id.Value}' has multiple phases for purpose '{purpose}'.");
        }

        ScaffoldStep? entryStep = matchingPhases[0].Steps
            .FirstOrDefault(step => step.CanStartCold);

        if (entryStep is null)
        {
            throw new InvalidOperationException(
                $"Scaffold phase '{matchingPhases[0].Id.Value}' has no cold-start step.");
        }

        return new ScaffoldEntry(scaffold.Id, entryStep.Id);
    }
}
