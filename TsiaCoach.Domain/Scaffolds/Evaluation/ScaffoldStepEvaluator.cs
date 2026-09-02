using TsiaCoach.Domain.Mathematics;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Scaffolds.Evaluation;

public static class ScaffoldStepEvaluator
{
    public static ScaffoldStepEvaluation Evaluate(
        Scaffold scaffold,
        PracticeItem practiceItem,
        ScaffoldStepId stepId,
        ScaffoldStepSubmission submission)
    {
        if (scaffold.PracticeItemId != practiceItem.Id)
        {
            throw new InvalidOperationException(
                $"Scaffold '{scaffold.Id.Value}' targets practice item " +
                $"'{scaffold.PracticeItemId.Value}', not '{practiceItem.Id.Value}'.");
        }

        ScaffoldStep step = scaffold.Step(stepId);

        bool satisfied = (step.Action.Value, step.SuccessCheck.Value, submission.Value) switch
        {
            (MatchEquivalentLength, LengthsAreEquivalent, MatchEquivalentLengthSubmission value) =>
                EvaluateLengthsAreEquivalent(scaffold, practiceItem, step, value),
            (ClassifyByFit, MatchesComputedFit, ClassifyByFitSubmission value) =>
                EvaluateMatchesComputedFit(scaffold, practiceItem, step, value),
            (NameFitClassification, MatchesIntegerDomain check, NameFitClassificationSubmission value) =>
                value.Domain == check.Domain,
            (TraverseAllGaps, AllGapsTraversed check, TraverseAllGapsSubmission value) =>
                EvaluateAllGapsTraversed(scaffold, practiceItem, step, check, value),
            (JoinQuantities, MatchesPartComposition, JoinQuantitiesSubmission value) =>
                EvaluateMatchesPartComposition(practiceItem, step, value),
            (EnterScalar, MatchesLatentScalar check, EnterScalarSubmission value) =>
                value.Value == RequireLatentScalar(practiceItem, check.ExpectedValueId).Value,
            (BuildExpression, MatchesLatentExpression check, BuildExpressionSubmission value) =>
                EvaluateMatchesLatentExpression(practiceItem, check, value),
            (SelectAnswerChoice, MatchesCorrectAnswer, SelectAnswerChoiceSubmission value) =>
                practiceItem.Evaluate(value.AnswerChoiceId).Value is CorrectCheck,
            (_, _, MatchEquivalentLengthSubmission or
                ClassifyByFitSubmission or
                NameFitClassificationSubmission or
                TraverseAllGapsSubmission or
                JoinQuantitiesSubmission or
                EnterScalarSubmission or
                BuildExpressionSubmission or
                SelectAnswerChoiceSubmission) =>
                throw new InvalidOperationException(
                    $"Submission is incompatible with scaffold step '{step.Id.Value}'."),
            _ => throw Unsupported("scaffold step submission", submission.Value)
        };

        return satisfied
            ? new ScaffoldStepSatisfied()
            : new ScaffoldStepNotSatisfied();
    }

    private static bool EvaluateLengthsAreEquivalent(
        Scaffold scaffold,
        PracticeItem practiceItem,
        ScaffoldStep step,
        MatchEquivalentLengthSubmission submission)
    {
        RodEquivalenceScene scene = SceneFor<RodEquivalenceScene>(step);
        IReadOnlyDictionary<ScaffoldResourceId, ScaffoldResource> resources = ResourceMap(scaffold);
        RodResource unitRod = RequireResource<RodResource>(scene.UnitRodId, resources);
        RodResource probeRod = RequireResource<RodResource>(scene.ProbeRodId, resources);

        UnitLength unitLength = ResolveLength(unitRod.Length, practiceItem);
        UnitLength probeLength = ResolveLength(probeRod.Length, practiceItem);

        return submission.UnitRodCount.Value * unitLength.Value == probeLength.Value;
    }

    private static bool EvaluateMatchesComputedFit(
        Scaffold scaffold,
        PracticeItem practiceItem,
        ScaffoldStep step,
        ClassifyByFitSubmission submission)
    {
        RodMeasurementScene scene = SceneFor<RodMeasurementScene>(step);
        IReadOnlyDictionary<ScaffoldResourceId, ScaffoldResource> resources = ResourceMap(scaffold);
        RodResource probeRod = RequireResource<RodResource>(scene.ProbeRodId, resources);
        RodSeriesResource spanSeries = RequireResource<RodSeriesResource>(scene.SpanSeriesId, resources);
        UnitLength probeLength = ResolveLength(probeRod.Length, practiceItem);

        var submitted = new Dictionary<UnitLength, FitClassification>();

        foreach (FitClassificationEntry entry in submission.Classifications)
        {
            if (!submitted.TryAdd(entry.Length, entry.Classification))
            {
                throw new InvalidOperationException(
                    $"Duplicate classification for length '{entry.Length.Value}'.");
            }
        }

        Dictionary<UnitLength, FitClassification> expected = spanSeries.Lengths
            .ToDictionary(
                length => length,
                length => ClassificationFrom(RodFit.Measure(probeLength, length)));

        return submitted.Count == expected.Count &&
            expected.All(pair =>
                submitted.TryGetValue(pair.Key, out FitClassification classification) &&
                classification == pair.Value);
    }

    private static bool EvaluateAllGapsTraversed(
        Scaffold scaffold,
        PracticeItem practiceItem,
        ScaffoldStep step,
        AllGapsTraversed check,
        TraverseAllGapsSubmission submission)
    {
        RodGapScene scene = SceneFor<RodGapScene>(step);
        IReadOnlyDictionary<ScaffoldResourceId, ScaffoldResource> resources = ResourceMap(scaffold);

        RodResource requiredRod = RequireResource<RodResource>(check.RequiredResourceId, resources);
        UnitLength requiredLength = ResolveLength(requiredRod.Length, practiceItem);
        RodResource probeRod = RequireResource<RodResource>(scene.StepRodId, resources);
        RodSeriesResource spanSeries = RequireResource<RodSeriesResource>(scene.SpanSeriesId, resources);
        UnitLength probeLength = ResolveLength(probeRod.Length, practiceItem);

        List<UnitLength> includedLengths = spanSeries.Lengths
            .Where(length => ClassificationFrom(RodFit.Measure(probeLength, length)) == scene.IncludedOutcome)
            .ToList();
        List<GapTraversal> expected = includedLengths
            .Zip(includedLengths.Skip(1))
            .Select(pair => new GapTraversal(pair.First, pair.Second, check.RequiredResourceId))
            .ToList();

        foreach (GapTraversal traversal in submission.Traversals)
        {
            if (!resources.ContainsKey(traversal.ResourceId))
            {
                throw new InvalidOperationException(
                    $"Scaffold resource '{traversal.ResourceId.Value}' does not exist.");
            }

            if (traversal.ResourceId != check.RequiredResourceId ||
                traversal.To.Value - traversal.From.Value != requiredLength.Value)
            {
                return false;
            }
        }

        return submission.Traversals.SequenceEqual(expected);
    }

    private static bool EvaluateMatchesPartComposition(
        PracticeItem practiceItem,
        ScaffoldStep step,
        JoinQuantitiesSubmission submission)
    {
        QuantityJoinScene scene = SceneFor<QuantityJoinScene>(step);

        foreach (QuantityReference part in submission.Parts)
        {
            ValidateSubmittedQuantityReference(practiceItem, part);
        }

        IReadOnlyDictionary<string, int> expected = Multiset(scene.Parts);
        IReadOnlyDictionary<string, int> submitted = Multiset(submission.Parts);

        return expected.Count == submitted.Count &&
            expected.All(pair =>
                submitted.TryGetValue(pair.Key, out int count) &&
                count == pair.Value);
    }

    private static bool EvaluateMatchesLatentExpression(
        PracticeItem practiceItem,
        MatchesLatentExpression check,
        BuildExpressionSubmission submission)
    {
        if (!practiceItem.Mathematics.Objects.Any(value => value.Id == submission.MathObjectId))
        {
            throw new InvalidOperationException(
                $"Math object '{submission.MathObjectId.Value}' does not belong to practice item " +
                $"'{practiceItem.Id.Value}'.");
        }

        DerivedExpression expression = RequireLatentExpression(
            practiceItem,
            check.ExpectedExpressionId);

        return submission.MathObjectId == expression.MathObjectId;
    }

    private static IReadOnlyDictionary<string, int> Multiset(
        IReadOnlyList<QuantityReference> references)
    {
        var counts = new Dictionary<string, int>();

        foreach (QuantityReference reference in references)
        {
            string key = QuantityReferenceKey(reference);
            counts.TryGetValue(key, out int count);
            counts[key] = count + 1;
        }

        return counts;
    }

    private static void ValidateSubmittedQuantityReference(
        PracticeItem practiceItem,
        QuantityReference reference)
    {
        switch (reference.Value)
        {
            case SemanticQuantityReference semantic:
                if (!practiceItem.Semantics.Entities.Any(entity => EntityId(entity) == semantic.SemanticEntityId))
                {
                    throw new InvalidOperationException(
                        $"Semantic entity '{semantic.SemanticEntityId.Value}' does not exist in the practice item.");
                }
                break;
            case LatentExpressionReference latent:
                _ = RequireLatentExpression(practiceItem, latent.LatentMathId);
                break;
            default:
                throw Unsupported("quantity reference", reference.Value);
        }
    }

    private static string QuantityReferenceKey(QuantityReference reference) =>
        reference.Value switch
        {
            SemanticQuantityReference semantic => $"semantic:{semantic.SemanticEntityId.Value}",
            LatentExpressionReference latent => $"latent-expression:{latent.LatentMathId.Value}",
            _ => throw Unsupported("quantity reference", reference.Value)
        };

    private static IReadOnlyDictionary<ScaffoldResourceId, ScaffoldResource> ResourceMap(
        Scaffold scaffold) =>
        scaffold.Resources.ToDictionary(ResourceId);

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

    private static TScene SceneFor<TScene>(ScaffoldStep step)
        where TScene : class
    {
        if (step.Scene.Value is not TScene scene)
        {
            throw new InvalidOperationException(
                $"Scaffold step '{step.Id.Value}' does not use a {typeof(TScene).Name}.");
        }

        return scene;
    }

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

    private static UnitLength ResolveLength(
        LengthSource source,
        PracticeItem practiceItem) =>
        source.Value switch
        {
            LiteralLength literal => literal.Value,
            LatentLengthReference latent => ScalarToLength(
                latent.LatentMathId,
                RequireLatentScalar(practiceItem, latent.LatentMathId)),
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

    private static FitClassification ClassificationFrom(FitOutcome outcome) =>
        outcome.Value switch
        {
            FlushFit => FitClassification.Flush,
            RemainderFit { Remainder.Value: 1 } => FitClassification.OneUnitLeftover,
            RemainderFit remainder => throw new InvalidOperationException(
                $"Computed fit remainder '{remainder.Remainder.Value}' is not representable."),
            _ => throw Unsupported("fit outcome", outcome.Value)
        };

    private static DerivedScalar RequireLatentScalar(
        PracticeItem practiceItem,
        LatentMathId id)
    {
        DerivedScalar? scalar = practiceItem.Semantics.LatentFacts
            .Select(fact => fact.Value)
            .OfType<DerivedScalar>()
            .SingleOrDefault(fact => fact.Id == id);

        if (scalar is null)
        {
            throw new InvalidOperationException(
                $"Latent math '{id.Value}' is missing or is not a scalar.");
        }

        return scalar;
    }

    private static DerivedExpression RequireLatentExpression(
        PracticeItem practiceItem,
        LatentMathId id)
    {
        DerivedExpression? expression = practiceItem.Semantics.LatentFacts
            .Select(fact => fact.Value)
            .OfType<DerivedExpression>()
            .SingleOrDefault(fact => fact.Id == id);

        if (expression is null)
        {
            throw new InvalidOperationException(
                $"Latent math '{id.Value}' is missing or is not an expression.");
        }

        return expression;
    }

    private static InvalidOperationException Unsupported(string kind, object? value) =>
        new($"Unsupported {kind} case: {value?.GetType().Name ?? "null"}.");
}
