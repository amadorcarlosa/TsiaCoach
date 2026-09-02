using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Scaffolds;

/// <summary>
/// One flat, ordered path of steps that writes out the latent math a practice
/// item compresses. Every step carries its own scene, so any step is a valid
/// entry point; purpose is a label on the step, not a container that routes.
/// </summary>
public sealed record Scaffold(
    ScaffoldId Id,
    PracticeItemId PracticeItemId,
    IReadOnlyList<ScaffoldResource> Resources,
    IReadOnlyList<ScaffoldStep> Steps
)
{
    public static Scaffold Create(
        ScaffoldId id,
        PracticeItem practiceItem,
        IReadOnlyList<ScaffoldResource> resources,
        IReadOnlyList<ScaffoldStep> steps)
    {
        var scaffold = new Scaffold(
            Id: id,
            PracticeItemId: practiceItem.Id,
            Resources: resources,
            Steps: steps);

        ScaffoldValidator.Validate(scaffold, practiceItem);
        return scaffold;
    }

    public ScaffoldStep FloorStep => Steps[0];

    public bool ContainsStep(ScaffoldStepId stepId) =>
        Steps.Any(step => step.Id == stepId);

    public ScaffoldStep Step(ScaffoldStepId stepId) =>
        Steps.FirstOrDefault(step => step.Id == stepId)
        ?? throw new InvalidOperationException(
            $"Scaffold step '{stepId.Value}' does not exist in scaffold '{Id.Value}'.");

    public int IndexOf(ScaffoldStepId stepId)
    {
        for (int index = 0; index < Steps.Count; index++)
        {
            if (Steps[index].Id == stepId)
            {
                return index;
            }
        }

        throw new InvalidOperationException(
            $"Scaffold step '{stepId.Value}' does not exist in scaffold '{Id.Value}'.");
    }

    /// <summary>
    /// The steps a session traverses from an entry: the entry itself, then
    /// every later step that is not entry-only. Entry-only steps are landing
    /// points for a routed student and are skipped in ordinary progress.
    /// </summary>
    public IReadOnlyList<ScaffoldStep> PathFrom(ScaffoldStepId entryStepId)
    {
        int entryIndex = IndexOf(entryStepId);

        return Steps
            .Skip(entryIndex)
            .Where((step, offset) => offset == 0 || !step.EntryOnly)
            .ToArray();
    }
}

/// <param name="EntryOnly">
/// True for a side step that only a routed student lands on, such as the
/// contrast pair after the pattern question. Ordinary progress skips it.
/// </param>
public sealed record ScaffoldStep(
    ScaffoldStepId Id,
    ScaffoldPhasePurpose Purpose,
    ScaffoldPrompt Prompt,
    ScaffoldScene Scene,
    LearnerAction Action,
    SuccessCheck SuccessCheck,
    bool EntryOnly = false
);

public sealed record ScaffoldPrompt(
    string Text,
    IReadOnlyList<PhraseId> FocusPhraseIds
);

public enum ScaffoldPhasePurpose
{
    ConceptFormation,
    LanguageInterpretation,
    Representation,
    Generalization,
    Verification
}
