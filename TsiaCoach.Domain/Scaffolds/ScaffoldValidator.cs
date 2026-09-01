using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Scaffolds;

public static class ScaffoldValidator
{
    public static void Validate(Scaffold scaffold, PracticeItem practiceItem)
    {
        if (scaffold.PracticeItemId != practiceItem.Id)
        {
            throw new InvalidOperationException(
                $"Scaffold '{scaffold.Id.Value}' targets practice item " +
                $"'{scaffold.PracticeItemId.Value}', not '{practiceItem.Id.Value}'.");
        }

        if (scaffold.Resources.Count == 0)
        {
            throw new InvalidOperationException("A scaffold must declare at least one resource.");
        }

        if (scaffold.Phases.Count == 0)
        {
            throw new InvalidOperationException("A scaffold must contain at least one phase.");
        }

        EnsureUnique(
            scaffold.Resources.Select(ResourceId),
            id => id.Value,
            "scaffold resource");

        Dictionary<ScaffoldResourceId, ScaffoldResource> resources = scaffold.Resources
            .ToDictionary(ResourceId);

        EnsureUnique(
            scaffold.Phases.Select(phase => phase.Id),
            id => id.Value,
            "scaffold phase");

        Dictionary<LatentMathId, DerivedScalar> latentScalars = practiceItem.Semantics
            .LatentFacts
            .Select(fact => fact.Value)
            .OfType<DerivedScalar>()
            .ToDictionary(fact => fact.Id);

        Dictionary<LatentMathId, DerivedExpression> latentExpressions = practiceItem.Semantics
            .LatentFacts
            .Select(fact => fact.Value)
            .OfType<DerivedExpression>()
            .ToDictionary(fact => fact.Id);

        HashSet<SemanticEntityId> semanticEntityIds = practiceItem.Semantics.Entities
            .Select(EntityId)
            .ToHashSet();

        HashSet<PhraseId> phraseIds = practiceItem.Text.Phrases
            .Select(phrase => phrase.Id)
            .ToHashSet();

        foreach (ScaffoldResource resource in scaffold.Resources)
        {
            ValidateResource(resource, latentScalars);
        }

        var authoredSteps = new Dictionary<ScaffoldStepId, ScaffoldStep>();

        foreach (ScaffoldPhase phase in scaffold.Phases)
        {
            if (phase.Steps.Count == 0)
            {
                throw new InvalidOperationException(
                    $"Scaffold phase '{phase.Id.Value}' must contain at least one step.");
            }

            foreach (ScaffoldStep step in phase.Steps)
            {
                if (!authoredSteps.TryAdd(step.Id, step))
                {
                    throw new InvalidOperationException(
                        $"Duplicate scaffold step id '{step.Id.Value}'.");
                }

                ValidatePrompt(step, phraseIds);
                ValidateScene(
                    step,
                    authoredSteps,
                    resources,
                    semanticEntityIds,
                    latentExpressions);
                ValidateInteraction(
                    step,
                    authoredSteps,
                    resources,
                    latentScalars,
                    latentExpressions);
            }
        }
    }

    private static void ValidateResource(
        ScaffoldResource resource,
        IReadOnlyDictionary<LatentMathId, DerivedScalar> latentScalars)
    {
        switch (resource.Value)
        {
            case RodResource rod:
                if (rod.Length.Value is LatentLengthReference reference)
                {
                    DerivedScalar scalar = RequireLatentScalar(
                        reference.LatentMathId,
                        latentScalars);

                    if (scalar.Value <= 0 || scalar.Value != decimal.Truncate(scalar.Value))
                    {
                        throw new InvalidOperationException(
                            $"Rod resource '{rod.Id.Value}' requires a positive whole-unit length.");
                    }
                }
                break;

            case RodSeriesResource series:
                if (series.Lengths.Count == 0)
                {
                    throw new InvalidOperationException(
                        $"Rod series '{series.Id.Value}' must contain at least one length.");
                }

                if (series.Lengths.Select(length => length.Value).Distinct().Count() !=
                    series.Lengths.Count)
                {
                    throw new InvalidOperationException(
                        $"Rod series '{series.Id.Value}' cannot repeat a length.");
                }
                break;

            default:
                throw Unsupported("scaffold resource", resource.Value);
        }
    }

    private static void ValidatePrompt(
        ScaffoldStep step,
        IReadOnlySet<PhraseId> phraseIds)
    {
        if (string.IsNullOrWhiteSpace(step.Prompt.Text))
        {
            throw new InvalidOperationException(
                $"Scaffold step '{step.Id.Value}' must have prompt text.");
        }

        foreach (PhraseId phraseId in step.Prompt.FocusPhraseIds)
        {
            if (!phraseIds.Contains(phraseId))
            {
                throw new InvalidOperationException(
                    $"Scaffold step '{step.Id.Value}' references unknown phrase " +
                    $"'{phraseId.Value}'.");
            }
        }
    }

    private static void ValidateScene(
        ScaffoldStep step,
        IReadOnlyDictionary<ScaffoldStepId, ScaffoldStep> authoredSteps,
        IReadOnlyDictionary<ScaffoldResourceId, ScaffoldResource> resources,
        IReadOnlySet<SemanticEntityId> semanticEntityIds,
        IReadOnlyDictionary<LatentMathId, DerivedExpression> latentExpressions)
    {
        switch (step.Scene.Value)
        {
            case FreshScene fresh:
                ValidateSceneDefinition(
                    step.Id,
                    fresh.Definition,
                    authoredSteps,
                    resources,
                    semanticEntityIds,
                    latentExpressions);
                break;

            case ContinuedScene continued:
                if (continued.SourceStepId == step.Id ||
                    !authoredSteps.ContainsKey(continued.SourceStepId))
                {
                    throw new InvalidOperationException(
                        $"Scaffold step '{step.Id.Value}' must continue a previously authored step.");
                }
                break;

            default:
                throw Unsupported("step scene", step.Scene.Value);
        }
    }

    private static void ValidateSceneDefinition(
        ScaffoldStepId stepId,
        ScaffoldScene scene,
        IReadOnlyDictionary<ScaffoldStepId, ScaffoldStep> authoredSteps,
        IReadOnlyDictionary<ScaffoldResourceId, ScaffoldResource> resources,
        IReadOnlySet<SemanticEntityId> semanticEntityIds,
        IReadOnlyDictionary<LatentMathId, DerivedExpression> latentExpressions)
    {
        switch (scene.Value)
        {
            case RodEquivalenceScene equivalence:
                RequireResource<RodResource>(equivalence.UnitRodId, resources);
                RequireResource<RodResource>(equivalence.ProbeRodId, resources);
                break;

            case RodMeasurementScene measurement:
                RequireResource<RodResource>(measurement.ProbeRodId, resources);
                RequireResource<RodSeriesResource>(measurement.SpanSeriesId, resources);
                break;

            case RodGapScene gaps:
                RequireResource<RodResource>(gaps.StepRodId, resources);
                if (gaps.ClassificationStepId == stepId ||
                    !authoredSteps.ContainsKey(gaps.ClassificationStepId))
                {
                    throw new InvalidOperationException(
                        $"Rod-gap scene in step '{stepId.Value}' must reference a previous " +
                        "classification step.");
                }
                break;

            case QuantityJoinScene join:
                if (join.Parts.Count < 2)
                {
                    throw new InvalidOperationException(
                        $"Quantity-join scene in step '{stepId.Value}' requires at least two parts.");
                }

                foreach (QuantityReference part in join.Parts)
                {
                    switch (part.Value)
                    {
                        case SemanticQuantityReference semantic:
                            RequireEntity(semantic.SemanticEntityId, semanticEntityIds);
                            break;
                        case LatentExpressionReference latent:
                            RequireLatentExpression(latent.LatentMathId, latentExpressions);
                            break;
                        default:
                            throw Unsupported("quantity reference", part.Value);
                    }
                }

                EnsureUnique(
                    join.Bindings.Select(binding => binding.SemanticEntityId),
                    id => id.Value,
                    $"instructional binding in step '{stepId.Value}'");

                foreach (InstructionalBinding binding in join.Bindings)
                {
                    RequireEntity(binding.SemanticEntityId, semanticEntityIds);
                }
                break;

            case AnswerChoiceScene:
                break;

            default:
                throw Unsupported("scaffold scene", scene.Value);
        }
    }

    private static void ValidateInteraction(
        ScaffoldStep step,
        IReadOnlyDictionary<ScaffoldStepId, ScaffoldStep> authoredSteps,
        IReadOnlyDictionary<ScaffoldResourceId, ScaffoldResource> resources,
        IReadOnlyDictionary<LatentMathId, DerivedScalar> latentScalars,
        IReadOnlyDictionary<LatentMathId, DerivedExpression> latentExpressions)
    {
        object? action = step.Action.Value;
        object? check = step.SuccessCheck.Value;

        bool compatible = (action, check) switch
        {
            (MatchEquivalentLength, LengthsAreEquivalent) => true,
            (ClassifyByFit, MatchesComputedFit) => true,
            (NameFitClassification actionValue, MatchesIntegerDomain checkValue) =>
                actionValue.Classification == checkValue.Classification,
            (TraverseAllGaps, AllGapsTraversed checkValue) =>
                IsResource<RodResource>(checkValue.RequiredResourceId, resources),
            (JoinQuantities, MatchesPartComposition) => true,
            (EnterScalar actionValue, MatchesLatentScalar checkValue) =>
                actionValue.Reading == checkValue.Reading,
            (BuildExpression, MatchesLatentExpression) => true,
            (SelectAnswerChoice, MatchesCorrectAnswer) => true,
            _ => false
        };

        if (!compatible)
        {
            throw new InvalidOperationException(
                $"Scaffold step '{step.Id.Value}' has an incompatible learner action and check.");
        }

        if (action is MatchEquivalentLength)
        {
            _ = RequireFreshScene<RodEquivalenceScene>(step);
        }
        else if (action is ClassifyByFit)
        {
            _ = RequireFreshScene<RodMeasurementScene>(step);
        }
        else if (action is TraverseAllGaps && check is AllGapsTraversed gaps)
        {
            RequireResource<RodResource>(gaps.RequiredResourceId, resources);
            RodGapScene scene = RequireFreshScene<RodGapScene>(step);
            if (gaps.RequiredResourceId != scene.StepRodId)
            {
                throw new InvalidOperationException(
                    $"Rod-gap check in step '{step.Id.Value}' must use the scene step rod.");
            }

            RequireClassificationSourceStep(step, scene, authoredSteps);
        }
        else if (action is JoinQuantities)
        {
            _ = RequireFreshScene<QuantityJoinScene>(step);
        }

        if (check is MatchesComputedFit)
        {
            ValidateComputedFitIsRepresentable(step, resources, latentScalars);
        }
        else if (check is MatchesLatentScalar scalar)
        {
            RequireLatentScalar(scalar.ExpectedValueId, latentScalars);
        }
        else if (check is MatchesLatentExpression expression)
        {
            RequireLatentExpression(expression.ExpectedExpressionId, latentExpressions);
        }
    }

    private static void RequireClassificationSourceStep(
        ScaffoldStep step,
        RodGapScene scene,
        IReadOnlyDictionary<ScaffoldStepId, ScaffoldStep> authoredSteps)
    {
        if (!authoredSteps.TryGetValue(scene.ClassificationStepId, out ScaffoldStep? source) ||
            source.Id == step.Id ||
            source.Action.Value is not ClassifyByFit ||
            source.SuccessCheck.Value is not MatchesComputedFit ||
            source.Scene.Value is not FreshScene fresh ||
            fresh.Definition.Value is not RodMeasurementScene)
        {
            throw new InvalidOperationException(
                $"Rod-gap scene in step '{step.Id.Value}' must reference a prior " +
                "classification step with a rod-measurement scene.");
        }
    }

    private static TScene RequireFreshScene<TScene>(ScaffoldStep step)
        where TScene : class
    {
        if (step.Scene.Value is not FreshScene fresh ||
            fresh.Definition.Value is not TScene scene)
        {
            throw new InvalidOperationException(
                $"Scaffold step '{step.Id.Value}' must use a fresh {typeof(TScene).Name}.");
        }

        return scene;
    }

    private static void ValidateComputedFitIsRepresentable(
        ScaffoldStep step,
        IReadOnlyDictionary<ScaffoldResourceId, ScaffoldResource> resources,
        IReadOnlyDictionary<LatentMathId, DerivedScalar> latentScalars)
    {
        RodMeasurementScene scene = step.Scene.Value is FreshScene fresh &&
            fresh.Definition.Value is RodMeasurementScene measurement
                ? measurement
                : throw new InvalidOperationException(
                    $"Scaffold step '{step.Id.Value}' must use a rod-measurement scene.");

        RodResource probeRod = RequireResource<RodResource>(scene.ProbeRodId, resources);
        RodSeriesResource spanSeries =
            RequireResource<RodSeriesResource>(scene.SpanSeriesId, resources);
        UnitLength probeLength = ResolveLength(probeRod.Length, latentScalars);

        foreach (UnitLength span in spanSeries.Lengths)
        {
            FitOutcome outcome = RodFit.Measure(probeLength, span);
            if (outcome.Value is RemainderFit { Remainder.Value: not 1 } remainder)
            {
                throw new InvalidOperationException(
                    $"Scaffold step '{step.Id.Value}' produces unrepresentable fit " +
                    $"remainder '{remainder.Remainder.Value}'.");
            }
        }
    }

    private static UnitLength ResolveLength(
        LengthSource source,
        IReadOnlyDictionary<LatentMathId, DerivedScalar> latentScalars) =>
        source.Value switch
        {
            LiteralLength literal => literal.Value,
            LatentLengthReference latent => ScalarToLength(
                latent.LatentMathId,
                RequireLatentScalar(latent.LatentMathId, latentScalars)),
            _ => throw Unsupported("length source", source.Value)
        };

    private static UnitLength ScalarToLength(
        LatentMathId latentMathId,
        DerivedScalar scalar)
    {
        if (scalar.Value <= 0 || scalar.Value != decimal.Truncate(scalar.Value))
        {
            throw new InvalidOperationException(
                $"Latent math '{latentMathId.Value}' must be a positive whole-unit length.");
        }

        return new UnitLength(checked((int)scalar.Value));
    }

    private static ScaffoldResourceId ResourceId(ScaffoldResource resource) =>
        resource.Value switch
        {
            RodResource value => value.Id,
            RodSeriesResource value => value.Id,
            _ => throw Unsupported("scaffold resource", resource.Value)
        };

    private static SemanticEntityId EntityId(SemanticEntity entity) =>
        entity.Value switch
        {
            VariableQuantity value => value.Id,
            DerivedQuantity value => value.Id,
            OrderedSet value => value.Id,
            _ => throw Unsupported("semantic entity", entity.Value)
        };

    private static TResource RequireResource<TResource>(
        ScaffoldResourceId id,
        IReadOnlyDictionary<ScaffoldResourceId, ScaffoldResource> resources)
        where TResource : class
    {
        if (!resources.TryGetValue(id, out ScaffoldResource resource) ||
            resource.Value is not TResource typedResource)
        {
            throw new InvalidOperationException(
                $"Scaffold resource '{id.Value}' is missing or has the wrong type.");
        }

        return typedResource;
    }

    private static bool IsResource<TResource>(
        ScaffoldResourceId id,
        IReadOnlyDictionary<ScaffoldResourceId, ScaffoldResource> resources)
        where TResource : class =>
        resources.TryGetValue(id, out ScaffoldResource resource) &&
        resource.Value is TResource;

    private static DerivedScalar RequireLatentScalar(
        LatentMathId id,
        IReadOnlyDictionary<LatentMathId, DerivedScalar> latentScalars)
    {
        if (!latentScalars.TryGetValue(id, out DerivedScalar? scalar))
        {
            throw new InvalidOperationException(
                $"Latent math '{id.Value}' is missing or is not a scalar.");
        }

        return scalar;
    }

    private static DerivedExpression RequireLatentExpression(
        LatentMathId id,
        IReadOnlyDictionary<LatentMathId, DerivedExpression> latentExpressions)
    {
        if (!latentExpressions.TryGetValue(id, out DerivedExpression? expression))
        {
            throw new InvalidOperationException(
                $"Latent math '{id.Value}' is missing or is not an expression.");
        }

        return expression;
    }

    private static void RequireEntity(
        SemanticEntityId id,
        IReadOnlySet<SemanticEntityId> semanticEntityIds)
    {
        if (!semanticEntityIds.Contains(id))
        {
            throw new InvalidOperationException(
                $"Semantic entity '{id.Value}' does not exist in the practice item.");
        }
    }

    private static void EnsureUnique<T>(
        IEnumerable<T> values,
        Func<T, string> display,
        string kind)
        where T : notnull
    {
        var seen = new HashSet<T>();

        foreach (T value in values)
        {
            if (!seen.Add(value))
            {
                throw new InvalidOperationException(
                    $"Duplicate {kind} id '{display(value)}'.");
            }
        }
    }

    private static InvalidOperationException Unsupported(string kind, object? value) =>
        new($"Unsupported {kind} case: {value?.GetType().Name ?? "null"}.");
}
