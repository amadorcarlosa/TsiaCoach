using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.Coaching;

namespace TsiaCoach.WebApi.Attempts;

/// <summary>
/// Append-only record of probe routes per attempt. The latest route decides
/// the scaffold entry before a check; the student's answer text is never
/// stored, only the authored shape it resolved to.
/// </summary>
public sealed class InMemoryProbeRouteStore
{
    private readonly object sync = new();
    private readonly Dictionary<string, List<ProbeRoute>> routesByAttempt =
        new(StringComparer.Ordinal);

    public void Record(ProbeRoute route)
    {
        ArgumentNullException.ThrowIfNull(route);

        lock (sync)
        {
            if (!routesByAttempt.TryGetValue(route.AttemptId.Value, out List<ProbeRoute>? routes))
            {
                routes = [];
                routesByAttempt.Add(route.AttemptId.Value, routes);
            }

            routes.Add(route);
        }
    }

    public bool TryGetLatest(AttemptId attemptId, out ProbeRoute route)
    {
        lock (sync)
        {
            if (routesByAttempt.TryGetValue(attemptId.Value, out List<ProbeRoute>? routes) &&
                routes.Count > 0)
            {
                route = routes[^1];
                return true;
            }

            route = null!;
            return false;
        }
    }

    public IReadOnlyList<ProbeRoute> Snapshot(AttemptId attemptId)
    {
        lock (sync)
        {
            return routesByAttempt.TryGetValue(attemptId.Value, out List<ProbeRoute>? routes)
                ? routes.ToArray()
                : [];
        }
    }
}
