using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Scaffolds;

public sealed record Scaffold(
    ScaffoldId Id,
    PracticeItemId PracticeItemId,
    IReadOnlyList<ScaffoldResource> Resources,
    IReadOnlyList<ScaffoldPhase> Phases
)
{
    public static Scaffold Create(
        ScaffoldId id,
        PracticeItem practiceItem,
        IReadOnlyList<ScaffoldResource> resources,
        IReadOnlyList<ScaffoldPhase> phases)
    {
        var scaffold = new Scaffold(
            Id: id,
            PracticeItemId: practiceItem.Id,
            Resources: resources,
            Phases: phases);

        ScaffoldValidator.Validate(scaffold, practiceItem);
        return scaffold;
    }
}

public sealed record ScaffoldPhase(
    ScaffoldPhaseId Id,
    ScaffoldPhasePurpose Purpose,
    IReadOnlyList<ScaffoldStep> Steps
);

public sealed record ScaffoldStep(
    ScaffoldStepId Id,
    ScaffoldPrompt Prompt,
    StepScene Scene,
    LearnerAction Action,
    SuccessCheck SuccessCheck
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
