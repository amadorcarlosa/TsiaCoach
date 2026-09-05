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

        if (scaffold.Steps.Count == 0)
        {
            throw new InvalidOperationException("A scaffold must contain at least one step.");
        }

        EnsureUnique(
            scaffold.Resources.Select(ResourceId),
            id => id.Value,
            "scaffold resource");

        Dictionary<ScaffoldResourceId, ScaffoldResource> resources = scaffold.Resources
            .ToDictionary(ResourceId);

        EnsureUnique(
            scaffold.Steps.Select(step => step.Id),
            id => id.Value,
            "scaffold step");

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

        foreach (ScaffoldStep step in scaffold.Steps)
        {
            ValidatePrompt(step, phraseIds);
            ValidateScene(
                step,
                resources,
                semanticEntityIds,
                latentExpressions);
            ValidateInteraction(
                step,
                resources,
                latentScalars,
                latentExpressions);
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
        IReadOnlyDictionary<ScaffoldResourceId, ScaffoldResource> resources,
        IReadOnlySet<SemanticEntityId> semanticEntityIds,
        IReadOnlyDictionary<LatentMathId, DerivedExpression> latentExpressions)
    {
        ScaffoldStepId stepId = step.Id;

        switch (step.Scene.Value)
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
                RequireResource<RodSeriesResource>(gaps.SpanSeriesId, resources);
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

            case GridScene grid:
                ValidateGrid(stepId, grid);
                break;

            default:
                throw Unsupported("scaffold scene", step.Scene.Value);
        }
    }

    private static void ValidateGrid(ScaffoldStepId stepId, GridScene grid)
    {
        if (grid.Cols <= 0 || grid.Rows <= 0)
        {
            throw new InvalidOperationException(
                $"Grid scene in step '{stepId.Value}' must have positive dimensions.");
        }

        // A rod's length is bounded by Rod itself; only tiles need a length check here.
        foreach (GridPiece piece in grid.Reference)
        {
            if (piece.Length <= 0 ||
                piece.X < 0 || piece.Y < 0 ||
                piece.Right > grid.Cols || piece.Bottom > grid.Rows)
            {
                throw new InvalidOperationException(
                    $"Grid scene in step '{stepId.Value}' has a reference piece outside the grid.");
            }
        }

        GridPiece[] pieces = grid.Reference.ToArray();
        for (int i = 0; i < pieces.Length; i++)
        {
            for (int j = i + 1; j < pieces.Length; j++)
            {
                if (pieces[i].Overlaps(pieces[j]))
                {
                    throw new InvalidOperationException(
                        $"Grid scene in step '{stepId.Value}' has overlapping reference pieces.");
                }
            }
        }

        var targetRowYs = new HashSet<int>();
        foreach (GridRow row in grid.TargetRows)
        {
            if (row.Length <= 0 || row.Start < 0 || row.Y < 0 ||
                row.Start + row.Length > grid.Cols || row.Y >= grid.Rows)
            {
                throw new InvalidOperationException(
                    $"Grid scene in step '{stepId.Value}' has a target row outside the grid.");
            }

            if (!targetRowYs.Add(row.Y))
            {
                throw new InvalidOperationException(
                    $"Grid scene in step '{stepId.Value}' has two target rows on row {row.Y}.");
            }
        }
    }

    private static void ValidateInteraction(
        ScaffoldStep step,
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
            (PlacePieces place, MatchesRowCompositions compositions) =>
                place.AllowedRods.Count > 0 &&
                place.AllowedRods.Contains(compositions.StepRod) &&
                place.AllowedRods.Contains(Rod.White) &&
                compositions.StepRod.Units > 1,
            (MoveRows, MatchesRowPartition) => true,
            (SelectRows, MatchesRowSelection selection) =>
                selection.RequiredCount > 0 &&
                selection.Rule switch
                {
                    SelectionRule.ExactSet => selection.ExpectedRows.Count == selection.RequiredCount,
                    SelectionRule.AdjacentInList => selection.RequiredCount == 2,
                    _ => false
                },
            _ => false
        };

        if (!compatible)
        {
            throw new InvalidOperationException(
                $"Scaffold step '{step.Id.Value}' has an incompatible learner action and check.");
        }

        if (action is MatchEquivalentLength)
        {
            _ = RequireScene<RodEquivalenceScene>(step);
        }
        else if (action is ClassifyByFit)
        {
            RodMeasurementScene scene = RequireScene<RodMeasurementScene>(step);
            ValidateFitIsRepresentable(
                step,
                scene.ProbeRodId,
                scene.SpanSeriesId,
                resources,
                latentScalars);
        }
        else if (action is TraverseAllGaps && check is AllGapsTraversed gaps)
        {
            RequireResource<RodResource>(gaps.RequiredResourceId, resources);
            RodGapScene scene = RequireScene<RodGapScene>(step);
            if (gaps.RequiredResourceId != scene.StepRodId)
            {
                throw new InvalidOperationException(
                    $"Rod-gap check in step '{step.Id.Value}' must use the scene step rod.");
            }

            ValidateFitIsRepresentable(
                step,
                scene.StepRodId,
                scene.SpanSeriesId,
                resources,
                latentScalars);
        }
        else if (action is JoinQuantities)
        {
            _ = RequireScene<QuantityJoinScene>(step);
        }
        else if (action is PlacePieces)
        {
            GridScene grid = RequireScene<GridScene>(step);
            if (grid.TargetRows.Count == 0)
            {
                throw new InvalidOperationException(
                    $"Scaffold step '{step.Id.Value}' places pieces but its grid has no target rows.");
            }
        }
        else if (action is MoveRows move && check is MatchesRowPartition partition)
        {
            GridScene grid = RequireScene<GridScene>(step);
            HashSet<int> referenceRows = grid.Reference.Select(piece => piece.Y).ToHashSet();
            foreach (int row in partition.ExpectedMovedRows)
            {
                if (!referenceRows.Contains(row))
                {
                    throw new InvalidOperationException(
                        $"Scaffold step '{step.Id.Value}' expects row {row} to move but nothing is on it.");
                }
            }

            int widestTrain = grid.Reference
                .GroupBy(piece => piece.Y)
                .Max(row => row.Max(piece => piece.X + piece.Length) - row.Min(piece => piece.X));
            if (move.CompareColumn < 0 || move.CompareColumn + widestTrain > grid.Cols)
            {
                throw new InvalidOperationException(
                    $"Scaffold step '{step.Id.Value}' compare column {move.CompareColumn} does not fit the widest train.");
            }
        }
        else if (action is SelectRows && check is MatchesRowSelection selection)
        {
            GridScene grid = RequireScene<GridScene>(step);
            HashSet<int> referenceRows = grid.Reference.Select(piece => piece.Y).ToHashSet();
            foreach (int row in selection.SelectableRows)
            {
                if (!referenceRows.Contains(row))
                {
                    throw new InvalidOperationException(
                        $"Scaffold step '{step.Id.Value}' lets row {row} be selected but nothing is on it.");
                }
            }

            foreach (int row in selection.ExpectedRows)
            {
                if (!selection.SelectableRows.Contains(row))
                {
                    throw new InvalidOperationException(
                        $"Scaffold step '{step.Id.Value}' expects row {row}, which is not selectable.");
                }
            }
        }

        if (check is MatchesLatentScalar scalar)
        {
            RequireLatentScalar(scalar.ExpectedValueId, latentScalars);
        }
        else if (check is MatchesLatentExpression expression)
        {
            RequireLatentExpression(expression.ExpectedExpressionId, latentExpressions);
        }
    }

    private static TScene RequireScene<TScene>(ScaffoldStep step)
        where TScene : class
    {
        if (step.Scene.Value is not TScene scene)
        {
            throw new InvalidOperationException(
                $"Scaffold step '{step.Id.Value}' must use a {typeof(TScene).Name}.");
        }

        return scene;
    }

    private static void ValidateFitIsRepresentable(
        ScaffoldStep step,
        ScaffoldResourceId probeRodId,
        ScaffoldResourceId spanSeriesId,
        IReadOnlyDictionary<ScaffoldResourceId, ScaffoldResource> resources,
        IReadOnlyDictionary<LatentMathId, DerivedScalar> latentScalars)
    {
        RodResource probeRod = RequireResource<RodResource>(probeRodId, resources);
        RodSeriesResource spanSeries =
            RequireResource<RodSeriesResource>(spanSeriesId, resources);
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
