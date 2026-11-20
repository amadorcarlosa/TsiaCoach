using Microsoft.Extensions.Options;

namespace TsiaCoach.WebApi.PlaygroundEvents;

/// <summary>
/// Deletes playground sessions older than <see cref="PlaygroundEventOptions.RetentionDays"/>,
/// with their events: once shortly after start, then every sweep interval.
/// </summary>
public sealed class PlaygroundEventRetentionService(
    IPlaygroundEventStore store,
    IOptions<PlaygroundEventOptions> options,
    TimeProvider timeProvider,
    ILogger<PlaygroundEventRetentionService> logger) : BackgroundService
{
    public async Task<int> SweepAsync(CancellationToken cancellationToken)
    {
        int days = options.Value.RetentionDays;
        if (days <= 0) return 0;
        DateTimeOffset cutoff = timeProvider.GetUtcNow().AddDays(-days);
        int deleted = await store.DeleteStartedBeforeAsync(cutoff, cancellationToken);
        if (deleted > 0)
        {
            logger.LogInformation(
                "Deleted {SessionCount} playground sessions started before {Cutoff:o} ({RetentionDays}-day retention)",
                deleted, cutoff, days);
        }

        return deleted;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (options.Value.RetentionDays <= 0)
        {
            logger.LogInformation("Playground event retention is off; sessions are kept until deleted.");
            return;
        }

        // Let the app finish starting before the first sweep.
        TimeSpan delay = TimeSpan.FromMinutes(1);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(delay, timeProvider, stoppingToken);
                await SweepAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception exception)
            {
                // A failed sweep must not stop the API; the next one catches up.
                logger.LogWarning(exception, "Playground event retention sweep failed.");
            }

            delay = options.Value.RetentionSweepInterval;
        }
    }
}
