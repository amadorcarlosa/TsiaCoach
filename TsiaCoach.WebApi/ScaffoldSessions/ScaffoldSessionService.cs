using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.ScaffoldSessions;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.ValueObjects;

using TsiaCoach.WebApi.Attempts;

namespace TsiaCoach.WebApi.ScaffoldSessions;

public enum ScaffoldSessionStartServiceResultKind
{
    Created,
    Existing,
    UnknownAttempt,
    NotAuthorized
}

public sealed record ScaffoldSessionContext(
    ScaffoldSession Session,
    PracticeItem PracticeItem,
    Scaffold Scaffold);

public sealed record ScaffoldSessionStartServiceResult(
    ScaffoldSessionStartServiceResultKind Kind,
    ScaffoldSessionContext? Context = null,
    ScaffoldSessionDenied? Denial = null);

public sealed record ScaffoldSessionCheckServiceResult(
    ScaffoldSessionAppendResultKind Kind,
    ScaffoldSessionContext? Context = null,
    bool? Satisfied = null);

public sealed class ScaffoldSessionService
{
    private readonly SamplePracticeCatalog catalog;
    private readonly InMemoryAttemptStore attemptStore;
    private readonly InMemoryScaffoldSessionStore sessionStore;

    public ScaffoldSessionService(
        SamplePracticeCatalog catalog,
        InMemoryAttemptStore attemptStore,
        InMemoryScaffoldSessionStore sessionStore)
    {
        this.catalog = catalog;
        this.attemptStore = attemptStore;
        this.sessionStore = sessionStore;
    }

    public ScaffoldSessionStartServiceResult Start(AttemptId attemptId)
    {
        if (!attemptStore.TryGet(attemptId, out Attempt? attempt))
        {
            return new(ScaffoldSessionStartServiceResultKind.UnknownAttempt);
        }

        PracticeItemCatalogEntry entry = RequireCatalogEntry(attempt.PracticeItemId);
        ScaffoldSessionAuthorization authorization =
            ScaffoldSessionAuthorizer.Authorize(
                attempt,
                entry.Item,
                entry.CoachingPolicy);

        if (authorization.Value is ScaffoldSessionGrant grant)
        {
            Scaffold scaffold = RequireAuthorizedScaffold(entry, grant);
            ScaffoldSessionStartResult started = sessionStore.Start(grant, scaffold);
            return new(
                started.Kind switch
                {
                    ScaffoldSessionStartResultKind.Created =>
                        ScaffoldSessionStartServiceResultKind.Created,
                    ScaffoldSessionStartResultKind.Existing =>
                        ScaffoldSessionStartServiceResultKind.Existing,
                    _ => throw new InvalidOperationException("Unsupported scaffold session start result.")
                },
                Context: ContextFor(started.Session, entry.Item, scaffold));
        }

        ScaffoldSessionDenied denial = (ScaffoldSessionDenied)authorization.Value;

        // A previously issued grant remains valid even when the attempt has since changed.
        // When the current attempt no longer authorizes a new grant, return its existing session.
        if (sessionStore.TryGetForAttempt(attempt.Id, out ScaffoldSession? existing))
        {
            return new(
                ScaffoldSessionStartServiceResultKind.Existing,
                Context: ContextFor(existing));
        }

        return new(
            ScaffoldSessionStartServiceResultKind.NotAuthorized,
            Denial: denial);
    }

    public bool TryRead(
        ScaffoldSessionId sessionId,
        out ScaffoldSessionContext context)
    {
        if (!sessionStore.TryGet(sessionId, out ScaffoldSession? session))
        {
            context = null!;
            return false;
        }

        context = ContextFor(session);
        return true;
    }

    public ScaffoldSessionCheckServiceResult Check(
        ScaffoldSessionId sessionId,
        TsiaCoach.Domain.Scaffolds.Evaluation.ScaffoldStepSubmission submission)
    {
        if (!sessionStore.TryGet(sessionId, out ScaffoldSession? session))
        {
            return new(ScaffoldSessionAppendResultKind.UnknownSession);
        }

        ScaffoldSessionContext context = ContextFor(session);
        ScaffoldSessionAppendResult result = sessionStore.Append(
            sessionId,
            submission,
            context.PracticeItem,
            context.Scaffold);

        return result.Kind switch
        {
            ScaffoldSessionAppendResultKind.Appended => new(
                result.Kind,
                Context: ContextFor(result.Session!, context.PracticeItem, context.Scaffold),
                Satisfied: result.Satisfied),
            ScaffoldSessionAppendResultKind.UnknownSession => new(result.Kind),
            ScaffoldSessionAppendResultKind.Completed => new(
                result.Kind,
                Context: context),
            ScaffoldSessionAppendResultKind.InvalidSubmission => new(
                result.Kind,
                Context: context),
            _ => throw new InvalidOperationException("Unsupported scaffold session append result.")
        };
    }

    private PracticeItemCatalogEntry RequireCatalogEntry(PracticeItemId practiceItemId)
    {
        if (!catalog.TryFind(practiceItemId.Value, out PracticeItemCatalogEntry? entry))
        {
            throw new InvalidOperationException(
                $"Catalog has no practice item '{practiceItemId.Value}' for an attempt.");
        }

        if (entry.Item.Id != practiceItemId ||
            entry.CoachingPolicy.PracticeItemId != practiceItemId)
        {
            throw new InvalidOperationException(
                $"Catalog entry for practice item '{practiceItemId.Value}' is inconsistent.");
        }

        if (entry.Scaffold is not null && entry.Scaffold.PracticeItemId != practiceItemId)
        {
            throw new InvalidOperationException(
                $"Catalog scaffold for practice item '{practiceItemId.Value}' targets a different item.");
        }

        return entry;
    }

    private static Scaffold RequireAuthorizedScaffold(
        PracticeItemCatalogEntry entry,
        ScaffoldSessionGrant grant)
    {
        if (entry.Scaffold is null ||
            entry.Scaffold.Id != grant.ScaffoldId ||
            entry.Scaffold.PracticeItemId != grant.PracticeItemId)
        {
            throw new InvalidOperationException(
                $"Coaching route for practice item '{entry.Item.Id.Value}' does not match its authored scaffold.");
        }

        return entry.Scaffold;
    }

    private ScaffoldSessionContext ContextFor(
        ScaffoldSession session)
    {
        PracticeItemCatalogEntry entry = RequireCatalogEntry(session.PracticeItemId);
        Scaffold scaffold = entry.Scaffold is not null &&
            entry.Scaffold.Id == session.ScaffoldId
            ? entry.Scaffold
            : throw new InvalidOperationException(
                $"Session '{session.Id.Value}' does not match its catalog scaffold.");

        return ContextFor(session, entry.Item, scaffold);
    }

    private static ScaffoldSessionContext ContextFor(
        ScaffoldSession session,
        PracticeItem practiceItem,
        Scaffold scaffold) =>
        new(session, practiceItem, scaffold);
}
