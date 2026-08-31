using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.Coaching;

public sealed record ScaffoldEntry(
    ScaffoldId ScaffoldId,
    ScaffoldStepId EntryStepId);

public sealed record NoScaffoldAuthored;

public union CoachingRoute(
    ScaffoldEntry,
    NoScaffoldAuthored);
