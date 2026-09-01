using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.SampleCoaching;
using TsiaCoach.Domain.SampleQuestions;
using TsiaCoach.Domain.SampleScaffolds;
using TsiaCoach.Domain.Scaffolds;

namespace TsiaCoach.WebApi.Attempts;

public sealed record PracticeItemCatalogEntry(
    PracticeItem Item,
    CoachingPolicy CoachingPolicy,
    Scaffold? Scaffold);

public sealed class SamplePracticeCatalog
{
    private readonly IReadOnlyList<PracticeItemCatalogEntry> entries =
    [
        new(
            PracticeItemOne.Item,
            PracticeItemOneCoachingPolicy.Definition,
            ParityLadderScaffold.Definition),
        new(
            PracticeItemTwo.Item,
            PracticeItemTwoCoachingPolicy.Definition,
            null)
    ];

    private readonly IReadOnlyDictionary<string, PracticeItemCatalogEntry> entriesById;

    public SamplePracticeCatalog()
    {
        entriesById = entries.ToDictionary(entry => entry.Item.Id.Value, StringComparer.Ordinal);
    }

    public IReadOnlyList<PracticeItem> Items => entries.Select(entry => entry.Item).ToArray();

    public IReadOnlyList<Scaffold> Scaffolds => entries
        .Select(entry => entry.Scaffold)
        .OfType<Scaffold>()
        .ToArray();

    public bool TryFind(
        string id,
        out PracticeItemCatalogEntry entry) =>
        entriesById.TryGetValue(id, out entry!);

    public bool TryFindScaffold(
        string id,
        out Scaffold scaffold)
    {
        scaffold = Scaffolds.FirstOrDefault(candidate =>
            string.Equals(candidate.Id.Value, id, StringComparison.Ordinal))!;
        return scaffold is not null;
    }
}
