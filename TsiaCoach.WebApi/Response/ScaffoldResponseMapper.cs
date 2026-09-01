using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.ScaffoldSessions;
using TsiaCoach.Domain.Scaffolds.Evaluation;
using TsiaCoach.WebApi.ScaffoldSessions;

namespace TsiaCoach.WebApi.Response;

internal static class ScaffoldResponseMapper
{
    public static ScaffoldResponse ToResponse(Scaffold scaffold) =>
        new(
            Id: scaffold.Id.Value,
            PracticeItemId: scaffold.PracticeItemId.Value,
            Resources: scaffold.Resources.Select(ToResponse).ToArray(),
            Phases: scaffold.Phases.Select(ToResponse).ToArray());

    private static ScaffoldPhaseResponse ToResponse(ScaffoldPhase phase) =>
        new(
            Id: phase.Id.Value,
            Purpose: ContractName(phase.Purpose),
            Steps: phase.Steps.Select(ToResponse).ToArray());

    private static ScaffoldStepResponse ToResponse(ScaffoldStep step) =>
        new(
            Id: step.Id.Value,
            Prompt: new(
                Text: step.Prompt.Text,
                FocusPhraseIds: step.Prompt.FocusPhraseIds
                    .Select(id => id.Value)
                    .ToArray()),
            Scene: ToResponse(step.Scene),
            Action: ToResponse(step.Action),
            SuccessCheck: ToResponse(step.SuccessCheck));

    internal static ScaffoldResourceResponse ToResourceResponse(
        ScaffoldResource resource) => ToResponse(resource);

    internal static ScaffoldLearnerStepResponse ToLearnerStepResponse(
        ScaffoldStep step) =>
        new(
            Id: step.Id.Value,
            Prompt: new(
                Text: step.Prompt.Text,
                FocusPhraseIds: step.Prompt.FocusPhraseIds
                    .Select(id => id.Value)
                    .ToArray()),
            Scene: ToResponse(step.Scene),
            Action: ToResponse(step.Action));

    private static ScaffoldResourceResponse ToResponse(ScaffoldResource resource) =>
        resource.Value switch
        {
            RodResource value => new RodResourceResponse(
                Id: value.Id.Value,
                Length: ToResponse(value.Length),
                Multiplicity: ContractName(value.Multiplicity),
                Role: ContractName(value.Role)),
            RodSeriesResource value => new RodSeriesResourceResponse(
                Id: value.Id.Value,
                Lengths: value.Lengths.Select(length => length.Value).ToArray()),
            _ => throw Unsupported("scaffold resource", resource.Value)
        };

    private static LengthSourceResponse ToResponse(LengthSource source) =>
        source.Value switch
        {
            LiteralLength value => new LiteralLengthResponse(value.Value.Value),
            LatentLengthReference value => new LatentLengthReferenceResponse(
                value.LatentMathId.Value),
            _ => throw Unsupported("length source", source.Value)
        };

    private static StepSceneResponse ToResponse(StepScene scene) =>
        scene.Value switch
        {
            FreshScene value => new FreshSceneResponse(
                Definition: ToResponse(value.Definition)),
            ContinuedScene value => new ContinuedSceneResponse(
                SourceStepId: value.SourceStepId.Value,
                Access: ContractName(value.Access)),
            _ => throw Unsupported("step scene", scene.Value)
        };

    private static ScaffoldSceneResponse ToResponse(ScaffoldScene scene) =>
        scene.Value switch
        {
            RodEquivalenceScene value => new RodEquivalenceSceneResponse(
                UnitRodId: value.UnitRodId.Value,
                ProbeRodId: value.ProbeRodId.Value),
            RodMeasurementScene value => new RodMeasurementSceneResponse(
                ProbeRodId: value.ProbeRodId.Value,
                SpanSeriesId: value.SpanSeriesId.Value),
            RodGapScene value => new RodGapSceneResponse(
                StepRodId: value.StepRodId.Value,
                ClassificationStepId: value.ClassificationStepId.Value,
                IncludedOutcome: ContractName(value.IncludedOutcome)),
            QuantityJoinScene value => new QuantityJoinSceneResponse(
                Parts: value.Parts.Select(ToResponse).ToArray(),
                Bindings: value.Bindings.Select(binding =>
                    new InstructionalBindingResponse(
                        SemanticEntityId: binding.SemanticEntityId.Value,
                        Value: binding.Value.Value))
                    .ToArray(),
                ShowSizedTarget: value.ShowSizedTarget),
            AnswerChoiceScene => new AnswerChoiceSceneResponse(),
            _ => throw Unsupported("scaffold scene", scene.Value)
        };

    private static QuantityReferenceResponse ToResponse(QuantityReference reference) =>
        reference.Value switch
        {
            SemanticQuantityReference value => new SemanticQuantityReferenceResponse(
                value.SemanticEntityId.Value),
            LatentExpressionReference value => new LatentExpressionReferenceResponse(
                value.LatentMathId.Value),
            _ => throw Unsupported("quantity reference", reference.Value)
        };

    private static LearnerActionResponse ToResponse(LearnerAction action) =>
        action.Value switch
        {
            MatchEquivalentLength => new MatchEquivalentLengthActionResponse(),
            ClassifyByFit => new ClassifyByFitActionResponse(),
            NameFitClassification value => new NameFitClassificationActionResponse(
                ContractName(value.Classification)),
            TraverseAllGaps => new TraverseAllGapsActionResponse(),
            JoinQuantities => new JoinQuantitiesActionResponse(),
            EnterScalar value => new EnterScalarActionResponse(
                ContractName(value.Reading)),
            BuildExpression => new BuildExpressionActionResponse(),
            SelectAnswerChoice => new SelectAnswerChoiceActionResponse(),
            _ => throw Unsupported("learner action", action.Value)
        };

    private static SuccessCheckResponse ToResponse(SuccessCheck check) =>
        check.Value switch
        {
            LengthsAreEquivalent => new LengthsAreEquivalentCheckResponse(),
            MatchesComputedFit => new MatchesComputedFitCheckResponse(),
            MatchesIntegerDomain value => new MatchesIntegerDomainCheckResponse(
                Classification: ContractName(value.Classification),
                Domain: ContractName(value.Domain)),
            AllGapsTraversed value => new AllGapsTraversedCheckResponse(
                value.RequiredResourceId.Value),
            MatchesPartComposition => new MatchesPartCompositionCheckResponse(),
            MatchesLatentScalar value => new MatchesLatentScalarCheckResponse(
                ExpectedValueId: value.ExpectedValueId.Value,
                Reading: ContractName(value.Reading)),
            MatchesLatentExpression value => new MatchesLatentExpressionCheckResponse(
                value.ExpectedExpressionId.Value),
            MatchesCorrectAnswer => new MatchesCorrectAnswerCheckResponse(),
            _ => throw Unsupported("success check", check.Value)
        };

    private static string ContractName<TEnum>(TEnum value)
        where TEnum : struct, Enum
    {
        string name = value.ToString();

        return name.Length == 0
            ? name
            : char.ToLowerInvariant(name[0]) + name[1..];
    }

    private static InvalidOperationException Unsupported(string kind, object? value) =>
        new($"Unsupported {kind} case: {value?.GetType().Name ?? "null"}.");
}

internal static class ScaffoldSessionResponseMapper
{
    public static ScaffoldSessionResponse ToResponse(
        ScaffoldSessionContext context)
    {
        ScaffoldSession session = context.Session;
        ScaffoldSessionProgress progress = session.Progress(
            context.PracticeItem,
            context.Scaffold);

        ScaffoldSessionStateResponse state = progress.Value switch
        {
            ActiveScaffoldSession active => new ActiveScaffoldSessionResponse(
                FindLearnerStep(context.Scaffold, active.CurrentStepId)),
            CompletedScaffoldSession => new CompletedScaffoldSessionResponse(),
            _ => throw new InvalidOperationException("Unsupported scaffold session progress.")
        };

        ScaffoldLastCheckResponse? lastCheck = session.Checks.Count == 0
            ? null
            : ToLastCheck(session, context);

        int completedStepCount = progress.Value switch
        {
            ActiveScaffoldSession active => active.CompletedStepCount,
            CompletedScaffoldSession completed => completed.TotalStepCount,
            _ => throw new InvalidOperationException("Unsupported scaffold session progress.")
        };

        int totalStepCount = progress.Value switch
        {
            ActiveScaffoldSession active => active.TotalStepCount,
            CompletedScaffoldSession completed => completed.TotalStepCount,
            _ => throw new InvalidOperationException("Unsupported scaffold session progress.")
        };

        return new(
            SessionId: session.Id.Value,
            AttemptId: session.AttemptId.Value,
            PracticeItemId: session.PracticeItemId.Value,
            ScaffoldId: session.ScaffoldId.Value,
            EntryStepId: session.EntryStepId.Value,
            CheckCount: session.Checks.Count,
            CompletedStepCount: completedStepCount,
            TotalStepCount: totalStepCount,
            Resources: context.Scaffold.Resources
                .Select(ScaffoldResponseMapper.ToResourceResponse)
                .ToArray(),
            State: state,
            LastCheck: lastCheck);
    }

    private static ScaffoldLearnerStepResponse FindLearnerStep(
        Scaffold scaffold,
        TsiaCoach.Domain.ValueObjects.ScaffoldStepId stepId)
    {
        ScaffoldStep step = scaffold.Phases
            .SelectMany(phase => phase.Steps)
            .SingleOrDefault(candidate => candidate.Id == stepId)
            ?? throw new InvalidOperationException(
                $"Scaffold step '{stepId.Value}' does not exist.");

        return ScaffoldResponseMapper.ToLearnerStepResponse(step);
    }

    private static ScaffoldLastCheckResponse ToLastCheck(
        ScaffoldSession session,
        ScaffoldSessionContext context)
    {
        ScaffoldCheckResult check = session.Checks[^1];
        ScaffoldStepEvaluation evaluation = ScaffoldStepEvaluator.Evaluate(
            context.Scaffold,
            context.PracticeItem,
            check.StepId,
            check.Submission);

        return new(
            StepId: check.StepId.Value,
            Satisfied: evaluation.Value is ScaffoldStepSatisfied);
    }
}
