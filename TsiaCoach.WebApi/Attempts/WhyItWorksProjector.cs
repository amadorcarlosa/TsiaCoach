using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.ValueObjects;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.Attempts;

internal static class WhyItWorksProjector
{
    public static WhyItWorksResponse Project(Attempt attempt, PracticeItem item)
    {
        if (attempt.Phase(item).Value is not AfterCorrectCheck correct)
        {
            throw new InvalidOperationException(
                "Why-it-works can only be projected after a correct check.");
        }

        AnswerChoiceId selectedAnswerId = correct.SelectedAnswerId;
        MathObjectId correctMathObjectId = item.AnswerMathBindings
            .Single(binding => binding.AnswerChoiceId == selectedAnswerId)
            .MathObjectId;

        DerivedExpression requestedValue = item.Semantics.LatentFacts
            .Select(fact => fact.Value)
            .OfType<DerivedExpression>()
            .Single(fact => fact.Meaning == LatentExpressionMeaning.RequestedValueSimplified);

        if (requestedValue.MathObjectId != correctMathObjectId)
        {
            throw new InvalidOperationException(
                "The requested-value fact does not belong to the selected correct answer.");
        }

        Dictionary<LatentMathId, LatentMath> factsById = item.Semantics.LatentFacts
            .ToDictionary(fact => fact.Value switch
            {
                DerivedScalar scalar => scalar.Id,
                DerivedExpression expression => expression.Id,
                _ => throw new InvalidOperationException("Unsupported latent math case.")
            });

        LatentMath requestedFact = new(requestedValue);
        var orderedFacts = new List<LatentMath>();
        var visited = new HashSet<LatentMathId> { requestedValue.Id };
        AddSourcesFirst(requestedFact, factsById, visited, orderedFacts);
        orderedFacts.Add(requestedFact);

        return new(
            AttemptId: attempt.Id.Value,
            PracticeItemId: attempt.PracticeItemId.Value,
            SelectedAnswerId: selectedAnswerId.Value,
            CheckCount: attempt.Checks.Count,
            ProvenanceChain: orderedFacts.Select(SampleQuestionResponseMapper.ToResponse).ToArray());
    }

    private static void AddSourcesFirst(
        LatentMath fact,
        IReadOnlyDictionary<LatentMathId, LatentMath> factsById,
        ISet<LatentMathId> visited,
        ICollection<LatentMath> orderedFacts)
    {
        LatentMathProvenance provenance = fact.Value switch
        {
            DerivedScalar scalar => scalar.Provenance,
            DerivedExpression expression => expression.Provenance,
            _ => throw new InvalidOperationException("Unsupported latent math case.")
        };

        foreach (LatentMathId sourceId in provenance.SourceLatentMathIds)
        {
            if (!visited.Add(sourceId))
            {
                continue;
            }

            if (!factsById.TryGetValue(sourceId, out LatentMath source))
            {
                throw new InvalidOperationException(
                    $"Latent math provenance references unknown fact '{sourceId.Value}'.");
            }

            AddSourcesFirst(source, factsById, visited, orderedFacts);
            orderedFacts.Add(source);
        }
    }
}
