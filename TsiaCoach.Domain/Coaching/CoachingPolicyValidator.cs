using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Coaching;

public static class CoachingPolicyValidator
{
    public static void Validate(
        PracticeItem practiceItem,
        IReadOnlyDictionary<MisconceptionCode, ScaffoldStepId> entryStepByCode,
        Scaffold scaffold)
    {
        if (entryStepByCode is null)
        {
            throw new InvalidOperationException("A coaching policy must provide an entry map.");
        }

        EnsureCoversAuthoredCodes(practiceItem, entryStepByCode.Keys);

        if (scaffold.PracticeItemId != practiceItem.Id)
        {
            throw new InvalidOperationException(
                $"Scaffold '{scaffold.Id.Value}' targets practice item " +
                $"'{scaffold.PracticeItemId.Value}', not '{practiceItem.Id.Value}'.");
        }

        foreach ((MisconceptionCode code, ScaffoldStepId stepId) in entryStepByCode)
        {
            if (!scaffold.ContainsStep(stepId))
            {
                throw new InvalidOperationException(
                    $"Coaching policy for practice item '{practiceItem.Id.Value}' routes " +
                    $"misconception '{code.Value}' to unknown scaffold step '{stepId.Value}'.");
            }
        }
    }

    public static void EnsureCoversAuthoredCodes(
        PracticeItem practiceItem,
        IEnumerable<MisconceptionCode> policyCodes)
    {
        HashSet<MisconceptionCode> authoredCodes = practiceItem.Distractors.Values.ToHashSet();
        HashSet<MisconceptionCode> provided = policyCodes.ToHashSet();

        if (!authoredCodes.SetEquals(provided))
        {
            string missing = string.Join(", ", authoredCodes
                .Except(provided)
                .Select(code => code.Value));
            string extra = string.Join(", ", provided
                .Except(authoredCodes)
                .Select(code => code.Value));

            throw new InvalidOperationException(
                $"Coaching policy for practice item '{practiceItem.Id.Value}' must cover exactly " +
                $"the authored misconception codes. Missing: [{missing}]. Extra: [{extra}].");
        }
    }
}
