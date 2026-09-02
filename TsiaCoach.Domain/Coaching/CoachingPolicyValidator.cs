using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Coaching;

public static class CoachingPolicyValidator
{
    public static void Validate(
        PracticeItem practiceItem,
        IReadOnlyDictionary<MisconceptionCode, ScaffoldStepId> entryStepByCode,
        Scaffold scaffold,
        ProbeQuestion probe)
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

        ValidateProbe(practiceItem, scaffold, probe);
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

    private static void ValidateProbe(
        PracticeItem practiceItem,
        Scaffold scaffold,
        ProbeQuestion probe)
    {
        if (probe is null)
        {
            throw new InvalidOperationException(
                $"Coaching policy for practice item '{practiceItem.Id.Value}' must author a probe.");
        }

        if (string.IsNullOrWhiteSpace(probe.Text))
        {
            throw new InvalidOperationException("A probe must have question text.");
        }

        if (probe.Shapes.Count == 0)
        {
            throw new InvalidOperationException("A probe must author at least one answer shape.");
        }

        HashSet<PhraseId> phraseIds = practiceItem.Text.Phrases
            .Select(phrase => phrase.Id)
            .ToHashSet();

        foreach (PhraseId phraseId in probe.FocusPhraseIds)
        {
            if (!phraseIds.Contains(phraseId))
            {
                throw new InvalidOperationException(
                    $"Probe references unknown phrase '{phraseId.Value}'.");
            }
        }

        var seen = new HashSet<ProbeShapeId>();
        foreach (ProbeAnswerShape shape in probe.Shapes)
        {
            if (!seen.Add(shape.Id))
            {
                throw new InvalidOperationException(
                    $"Duplicate probe answer shape '{shape.Id.Value}'.");
            }

            if (string.IsNullOrWhiteSpace(shape.Description) ||
                string.IsNullOrWhiteSpace(shape.RouteMessage))
            {
                throw new InvalidOperationException(
                    $"Probe answer shape '{shape.Id.Value}' must have a description and a route message.");
            }

            if (!scaffold.ContainsStep(shape.EntryStepId))
            {
                throw new InvalidOperationException(
                    $"Probe answer shape '{shape.Id.Value}' routes to unknown scaffold step " +
                    $"'{shape.EntryStepId.Value}'.");
            }
        }
    }
}
