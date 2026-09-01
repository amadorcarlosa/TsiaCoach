using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.Coaching;
using TsiaCoach.WebApi.Agents;
using TsiaCoach.WebApi.Attempts;
using TsiaCoach.WebApi.Request;
using TsiaCoach.WebApi.Response;

namespace TsiaCoach.WebApi.CoachingAgents;

public enum CoachingTurnResultKind
{
    Succeeded,
    BadRequest,
    NotFound,
    Conflict,
    RateLimited,
    Cancelled,
    ProviderFailure,
    InvalidModelOutput
}

public sealed record CoachingTurnResult(
    CoachingTurnResultKind Kind,
    CoachTurnResponse? Response = null);

public sealed class CoachingTurnService(
    SamplePracticeCatalog catalog,
    InMemoryAttemptStore attemptStore,
    CoachingAgentDefinitionFactory definitionFactory,
    ICoachingAgentRunner runner)
{
    public async Task<CoachingTurnResult> RunAsync(
        AttemptId attemptId,
        CoachTurnEvent requestedEvent,
        CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(requestedEvent))
        {
            return new(CoachingTurnResultKind.BadRequest);
        }

        if (!attemptStore.TryGet(attemptId, out Attempt? attempt) ||
            !catalog.TryFind(attempt.PracticeItemId.Value, out PracticeItemCatalogEntry? entry))
        {
            return new(CoachingTurnResultKind.NotFound);
        }

        object phase = attempt.Phase(entry.Item).Value
            ?? throw new InvalidOperationException(
                "Attempt phase projection returned no value.");

        if (!IsLegalEvent(phase, requestedEvent))
        {
            return new(CoachingTurnResultKind.Conflict);
        }

        CoachingAgentDefinition definition = definitionFactory.Create(
            attempt,
            entry,
            requestedEvent);

        CoachingAgentRunResult runResult;
        try
        {
            runResult = await runner.RunAsync(
                definition,
                cancellationToken);
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            return new(CoachingTurnResultKind.Cancelled);
        }

        if (runResult.Error is AgentError error)
        {
            return new(MapAgentError(error));
        }

        CoachTurnValidationResult validation =
            CoachTurnValidator.Validate(runResult.Text ?? string.Empty, definition);

        return validation.IsValid
            ? new(CoachingTurnResultKind.Succeeded, validation.Response)
            : new(CoachingTurnResultKind.InvalidModelOutput);
    }

    private static bool IsLegalEvent(
        object phase,
        CoachTurnEvent requestedEvent) =>
        phase switch
        {
            BeforeCheck =>
                requestedEvent == CoachTurnEvent.HelpRequested,
            AfterIncorrectCheck =>
                requestedEvent == CoachTurnEvent.DiagnosisRequested,
            AfterCorrectCheck =>
                requestedEvent == CoachTurnEvent.ExplainCorrect,
            _ => throw new InvalidOperationException(
                $"Unsupported coaching phase '{phase.GetType().Name}'.")
        };

    private static CoachingTurnResultKind MapAgentError(
        AgentError error) =>
        error.Value switch
        {
            RateLimited => CoachingTurnResultKind.RateLimited,
            Cancelled => CoachingTurnResultKind.Cancelled,
            AuthFailed => CoachingTurnResultKind.ProviderFailure,
            DeploymentNotFound => CoachingTurnResultKind.ProviderFailure,
            MissingConfig => CoachingTurnResultKind.ProviderFailure,
            UnknownModel => CoachingTurnResultKind.ProviderFailure,
            _ => CoachingTurnResultKind.ProviderFailure
        };
}
