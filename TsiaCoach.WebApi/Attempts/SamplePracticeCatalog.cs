using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.SampleCoaching;
using TsiaCoach.Domain.SampleQuestions;

namespace TsiaCoach.WebApi.Attempts;

public sealed record PracticeItemCatalogEntry(
    PracticeItem Item,
    CoachingPolicy CoachingPolicy);

public sealed class SamplePracticeCatalog
{
    private readonly IReadOnlyList<PracticeItemCatalogEntry> entries =
    [
        new(PracticeItemOne.Item, PracticeItemOneCoachingPolicy.Definition),
        new(PracticeItemTwo.Item, PracticeItemTwoCoachingPolicy.Definition)
    ];

    private readonly IReadOnlyDictionary<string, PracticeItemCatalogEntry> entriesById;

    public SamplePracticeCatalog()
    {
        entriesById = entries.ToDictionary(entry => entry.Item.Id.Value, StringComparer.Ordinal);
    }

    public IReadOnlyList<PracticeItem> Items => entries.Select(entry => entry.Item).ToArray();

    public bool TryFind(
        string id,
        out PracticeItemCatalogEntry entry) =>
        entriesById.TryGetValue(id, out entry!);
}
