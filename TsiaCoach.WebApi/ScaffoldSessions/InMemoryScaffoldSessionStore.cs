using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.ScaffoldSessions;
using TsiaCoach.Domain.Scaffolds;
using TsiaCoach.Domain.Scaffolds.Evaluation;

namespace TsiaCoach.WebApi.ScaffoldSessions;

public enum ScaffoldSessionStartResultKind
{
    Created,
    Existing
}

public sealed record ScaffoldSessionStartResult(
    ScaffoldSessionStartResultKind Kind,
    ScaffoldSession Session);

public enum ScaffoldSessionAppendResultKind
{
    Appended,
    UnknownSession,
    Completed,
    InvalidSubmission
}

public sealed record ScaffoldSessionAppendResult(
    ScaffoldSessionAppendResultKind Kind,
    ScaffoldSession? Session = null,
    bool? Satisfied = null);

public sealed class InMemoryScaffoldSessionStore
{
    private readonly object sync = new();
    private readonly Dictionary<string, ScaffoldSession> sessions = new(StringComparer.Ordinal);
    private readonly Dictionary<SessionKey, string> sessionIdsByRoute = [];
    private readonly Dictionary<string, List<string>> sessionIdsByAttempt = new(StringComparer.Ordinal);
    private readonly TimeProvider timeProvider;

    public InMemoryScaffoldSessionStore(TimeProvider timeProvider)
    {
        this.timeProvider = timeProvider;
    }

    public ScaffoldSessionStartResult Start(
        ScaffoldSessionGrant grant,
        Scaffold scaffold)
    {
        lock (sync)
        {
            SessionKey key = new(
                grant.AttemptId.Value,
                grant.ScaffoldId.Value,
                grant.EntryStepId.Value);

            if (sessionIdsByRoute.TryGetValue(key, out string? existingId))
            {
                return new(
                    ScaffoldSessionStartResultKind.Existing,
                    sessions[existingId]);
            }

            ScaffoldSession session;
            do
            {
                session = ScaffoldSession.Start(
                    CreateSessionId(),
                    grant,
                    scaffold);
            }
            while (sessions.ContainsKey(session.Id.Value));

            sessions.Add(session.Id.Value, session);
            sessionIdsByRoute.Add(key, session.Id.Value);
            if (!sessionIdsByAttempt.TryGetValue(grant.AttemptId.Value, out List<string>? sessionIds))
            {
                sessionIds = [];
                sessionIdsByAttempt.Add(grant.AttemptId.Value, sessionIds);
            }

            sessionIds.Add(session.Id.Value);
            return new(ScaffoldSessionStartResultKind.Created, session);
        }
    }

    public bool TryGet(
        ScaffoldSessionId sessionId,
        out ScaffoldSession session)
    {
        lock (sync)
        {
            return sessions.TryGetValue(sessionId.Value, out session!);
        }
    }

    public bool TryGetForAttempt(
        AttemptId attemptId,
        out ScaffoldSession session)
    {
        lock (sync)
        {
            if (sessionIdsByAttempt.TryGetValue(attemptId.Value, out List<string>? sessionIds))
            {
                for (int index = sessionIds.Count - 1; index >= 0; index--)
                {
                    if (sessions.TryGetValue(sessionIds[index], out session!))
                    {
                        return true;
                    }
                }
            }

            session = null!;
            return false;
        }
    }

    public ScaffoldSessionAppendResult Append(
        ScaffoldSessionId sessionId,
        ScaffoldStepSubmission submission,
        PracticeItem practiceItem,
        Scaffold scaffold)
    {
        lock (sync)
        {
            if (!sessions.TryGetValue(sessionId.Value, out ScaffoldSession? current))
            {
                return new(ScaffoldSessionAppendResultKind.UnknownSession);
            }

            EnsureTargetsMatch(current, practiceItem, scaffold);

            ScaffoldSessionProgress progress = current.Progress(practiceItem, scaffold);
            if (progress.Value is CompletedScaffoldSession)
            {
                return new(ScaffoldSessionAppendResultKind.Completed, current);
            }

            ActiveScaffoldSession active = (ActiveScaffoldSession)progress.Value;
            ScaffoldStepEvaluation evaluation;
            try
            {
                evaluation = ScaffoldStepEvaluator.Evaluate(
                    scaffold,
                    practiceItem,
                    active.CurrentStepId,
                    submission);
            }
            catch (InvalidOperationException)
            {
                return new(ScaffoldSessionAppendResultKind.InvalidSubmission, current);
            }

            ScaffoldSession updated;
            try
            {
                updated = current.Append(
                    checkResultId: CreateCheckResultId(),
                    submission,
                    checkedAt: timeProvider.GetUtcNow(),
                    practiceItem,
                    scaffold);
            }
            catch (InvalidOperationException)
            {
                return new(ScaffoldSessionAppendResultKind.InvalidSubmission, current);
            }

            sessions[sessionId.Value] = updated;
            return new(
                ScaffoldSessionAppendResultKind.Appended,
                updated,
                evaluation.Value is ScaffoldStepSatisfied);
        }
    }

    private static void EnsureTargetsMatch(
        ScaffoldSession session,
        PracticeItem practiceItem,
        Scaffold scaffold)
    {
        if (session.PracticeItemId != practiceItem.Id ||
            session.ScaffoldId != scaffold.Id ||
            scaffold.PracticeItemId != practiceItem.Id)
        {
            throw new InvalidOperationException(
                $"Scaffold session '{session.Id.Value}' was supplied with incompatible catalog data.");
        }
    }

    private static ScaffoldSessionId CreateSessionId() =>
        new($"scaffold-session-{Guid.NewGuid():N}");

    private static ScaffoldCheckResultId CreateCheckResultId() =>
        new($"scaffold-check-{Guid.NewGuid():N}");

    private readonly record struct SessionKey(
        string AttemptId,
        string ScaffoldId,
        string EntryStepId);
}
