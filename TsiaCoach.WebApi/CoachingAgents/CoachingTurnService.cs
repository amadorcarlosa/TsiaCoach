using System.Diagnostics;
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
    ICoachingAgentRunner runner,
    ICoachingMoveRecorder moveRecorder,
    TimeProvider timeProvider,
    ILogger<CoachingTurnService> logger)
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

        long startedAt = Stopwatch.GetTimestamp();
        string eventName = CoachContractNames.EventName(requestedEvent);

        logger.LogInformation(
            "Starting coaching turn for attempt {AttemptId} phase {Phase} event {Event} model {Model}",
            attempt.Id.Value,
            definition.Phase,
            eventName,
            definition.Model);

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
            logger.LogInformation(
                "Coaching turn for attempt {AttemptId} phase {Phase} event {Event} model {Model} was cancelled after {ElapsedMilliseconds} ms",
                attempt.Id.Value,
                definition.Phase,
                eventName,
                definition.Model,
                Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds);

            return new(CoachingTurnResultKind.Cancelled);
        }

        if (runResult.Error is AgentError error)
        {
            CoachingTurnResultKind mapped = MapAgentError(error);

            logger.LogWarning(
                "Coaching turn for attempt {AttemptId} phase {Phase} event {Event} model {Model} ended as {ResultKind} after {ElapsedMilliseconds} ms with agent error {AgentErrorKind}",
                attempt.Id.Value,
                definition.Phase,
                eventName,
                definition.Model,
                mapped,
                Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds,
                AgentErrorKind(error));

            return new(mapped);
        }

        CoachTurnValidationResult validation =
            CoachTurnValidator.Validate(runResult.Text ?? string.Empty, definition);

        if (!validation.IsValid)
        {
            logger.LogWarning(
                "Coaching turn for attempt {AttemptId} phase {Phase} event {Event} model {Model} returned invalid model output after {ElapsedMilliseconds} ms with validation failure {ValidationFailure}",
                attempt.Id.Value,
                definition.Phase,
                eventName,
                definition.Model,
                Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds,
                validation.FailureReason);

            return new(CoachingTurnResultKind.InvalidModelOutput);
        }

        moveRecorder.Record(CreateRecord(
            attempt,
            definition,
            requestedEvent,
            validation.Response!));

        logger.LogInformation(
            "Completed coaching turn for attempt {AttemptId} phase {Phase} event {Event} model {Model} with move {MoveKind} in {ElapsedMilliseconds} ms",
            attempt.Id.Value,
            definition.Phase,
            eventName,
            definition.Model,
            MoveKind(validation.Response!.Move),
            Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds);

        return new(CoachingTurnResultKind.Succeeded, validation.Response);
    }

    private CoachingMoveRecord CreateRecord(
        Attempt attempt,
        CoachingAgentDefinition definition,
        CoachTurnEvent requestedEvent,
        CoachTurnResponse response)
    {
        (string moveKind, string? suggestedStepId, IReadOnlyList<string> provenanceFactIds) =
            response.Move switch
            {
                AskReadingQuestionResponse =>
                    (CoachContractNames.AskReadingQuestion, (string?)null,
                        (IReadOnlyList<string>)[]),
                DiagnoseDifferenceResponse =>
                    (CoachContractNames.DiagnoseDifference, null, []),
                SuggestScaffoldResponse suggest =>
                    (CoachContractNames.SuggestScaffold, suggest.SuggestedStepId, []),
                ExplainWhyResponse explain =>
                    (CoachContractNames.ExplainWhy, null, explain.ProvenanceFactIds),
                _ => throw new InvalidOperationException(
                    $"Unsupported coach move '{response.Move.GetType().Name}'.")
            };

        return new CoachingMoveRecord(
            RecordId: Guid.NewGuid().ToString("n"),
            AttemptId: attempt.Id.Value,
            PracticeItemId: attempt.PracticeItemId.Value,
            CheckCount: attempt.Checks.Count,
            Phase: definition.Phase,
            RequestedEvent: CoachContractNames.EventName(requestedEvent),
            MoveKind: moveKind,
            FocusPhraseIds: response.Move.FocusPhraseIds,
            SuggestedStepId: suggestedStepId,
            ProvenanceFactIds: provenanceFactIds,
            RecordedAt: timeProvider.GetUtcNow());
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
            ProviderRejected => CoachingTurnResultKind.ProviderFailure,
            _ => CoachingTurnResultKind.ProviderFailure
        };

    private static string AgentErrorKind(AgentError error) =>
        error.Value.GetType().Name;

    private static string MoveKind(CoachMoveResponse move) =>
        move switch
        {
            AskReadingQuestionResponse => CoachContractNames.AskReadingQuestion,
            DiagnoseDifferenceResponse => CoachContractNames.DiagnoseDifference,
            SuggestScaffoldResponse => CoachContractNames.SuggestScaffold,
            ExplainWhyResponse => CoachContractNames.ExplainWhy,
            _ => move.GetType().Name
        };
}
