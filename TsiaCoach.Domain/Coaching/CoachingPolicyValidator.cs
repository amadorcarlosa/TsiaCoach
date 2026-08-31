using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Coaching;

public static class CoachingPolicyValidator
{
    public static void Validate(
        PracticeItem practiceItem,
        IReadOnlyDictionary<MisconceptionCode, ScaffoldPhasePurpose> purposeByCode,
        Scaffold? scaffold)
    {
        if (purposeByCode is null)
        {
            throw new InvalidOperationException("A coaching policy must provide a purpose map.");
        }

        HashSet<MisconceptionCode> authoredCodes = practiceItem.Distractors.Values.ToHashSet();
        HashSet<MisconceptionCode> policyCodes = purposeByCode.Keys.ToHashSet();

        if (!authoredCodes.SetEquals(policyCodes))
        {
            string missing = string.Join(", ", authoredCodes
                .Except(policyCodes)
                .Select(code => code.Value));
            string extra = string.Join(", ", policyCodes
                .Except(authoredCodes)
                .Select(code => code.Value));

            throw new InvalidOperationException(
                $"Coaching policy for practice item '{practiceItem.Id.Value}' must cover exactly " +
                $"the authored misconception codes. Missing: [{missing}]. Extra: [{extra}].");
        }

        if (scaffold is null)
        {
            return;
        }

        if (scaffold.PracticeItemId != practiceItem.Id)
        {
            throw new InvalidOperationException(
                $"Scaffold '{scaffold.Id.Value}' targets practice item " +
                $"'{scaffold.PracticeItemId.Value}', not '{practiceItem.Id.Value}'.");
        }

        foreach (ScaffoldPhasePurpose purpose in purposeByCode.Values.Distinct())
        {
            ScaffoldPhase[] matchingPhases = scaffold.Phases
                .Where(phase => phase.Purpose == purpose)
                .ToArray();

            if (matchingPhases.Length != 1)
            {
                throw new InvalidOperationException(
                    matchingPhases.Length == 0
                        ? $"Scaffold '{scaffold.Id.Value}' has no phase for targeted purpose '{purpose}'."
                        : $"Scaffold '{scaffold.Id.Value}' has multiple phases for targeted purpose '{purpose}'.");
            }

            if (!matchingPhases[0].Steps.Any(step => step.CanStartCold))
            {
                throw new InvalidOperationException(
                    $"Scaffold phase '{matchingPhases[0].Id.Value}' has no cold-start step.");
            }
        }
    }
}
