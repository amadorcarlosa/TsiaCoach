using System.Diagnostics;
using TsiaCoach.Domain.Attempts;
using TsiaCoach.Domain.Coaching;
using TsiaCoach.Domain.ValueObjects;
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

/// <summary>
/// One coaching turn. Before a check, Help serves the authored probe with no
/// model call, and a probe answer is classified by the model into one
/// authored shape, whose route is recorded and returned. After a check the
/// phase-scoped diagnosis and explanation turns run as before. A question on
/// a scaffold step is legal in any phase: the model picks an authored shape
/// and the authored reply is served; the student is never moved.
/// </summary>
public sealed class CoachingTurnService(
    SamplePracticeCatalog catalog,
    InMemoryAttemptStore attemptStore,
    InMemoryProbeRouteStore probeRouteStore,
    CoachingAgentDefinitionFactory definitionFactory,
    ICoachingAgentRunner runner,
    ICoachingMoveRecorder moveRecorder,
    TimeProvider timeProvider,
    ILogger<CoachingTurnService> logger)
{
    public const int MaxProbeAnswerLength = 500;
    public const int MaxQuestionLength = 500;

    public async Task<CoachingTurnResult> RunAsync(
        AttemptId attemptId,
        CoachTurnRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null || !Enum.IsDefined(request.Event) || !IsWellFormed(request))
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

        if (!IsLegalEvent(phase, request.Event, entry.CoachingPolicy))
        {
            return new(CoachingTurnResultKind.Conflict);
        }

        if (request.Event == CoachTurnEvent.StepQuestionAsked &&
            entry.CoachingPolicy.StepQuestionsFor(new ScaffoldStepId(request.StepId!)) is null)
        {
            return new(CoachingTurnResultKind.BadRequest);
        }

        if (request.Event == CoachTurnEvent.HelpRequested)
        {
            return ServeProbe(attempt, entry, request.Event);
        }

        CoachingAgentDefinition definition = definitionFactory.Create(
            attempt,
            entry,
            request.Event,
            request.Answer,
            request.StepId,
            request.Question);

        long startedAt = Stopwatch.GetTimestamp();
        string eventName = CoachContractNames.EventName(request.Event);

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

        CoachTurnResponse response = validation.Response!;

        if (validation.ResolvedProbeShapeId is string shapeId &&
            response.Move is RouteToStepResponse route)
        {
            probeRouteStore.Record(new ProbeRoute(
                AttemptId: attempt.Id,
                ShapeId: new ProbeShapeId(shapeId),
                EntryStepId: new ScaffoldStepId(route.StepId),
                RoutedAt: timeProvider.GetUtcNow()));
        }

        moveRecorder.Record(CreateRecord(
            attempt,
            definition.Phase,
            request.Event,
            response));

        logger.LogInformation(
            "Completed coaching turn for attempt {AttemptId} phase {Phase} event {Event} model {Model} with move {MoveKind} in {ElapsedMilliseconds} ms",
            attempt.Id.Value,
            definition.Phase,
            eventName,
            definition.Model,
            MoveKind(response.Move),
            Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds);

        return new(CoachingTurnResultKind.Succeeded, response);
    }

    private CoachingTurnResult ServeProbe(
        Attempt attempt,
        PracticeItemCatalogEntry entry,
        CoachTurnEvent requestedEvent)
    {
        ProbeQuestion probe = entry.CoachingPolicy.Probe
            ?? throw new InvalidOperationException(
                $"Practice item '{entry.Item.Id.Value}' has no authored probe.");

        var response = new CoachTurnResponse(
            new AskProbeResponse(
                probe.Text,
                probe.FocusPhraseIds.Select(id => id.Value).ToArray()));

        moveRecorder.Record(CreateRecord(
            attempt,
            CoachContractNames.BeforeCheck,
            requestedEvent,
            response));

        logger.LogInformation(
            "Served authored probe for attempt {AttemptId} phase {Phase} event {Event}",
            attempt.Id.Value,
            CoachContractNames.BeforeCheck,
            CoachContractNames.EventName(requestedEvent));

        return new(CoachingTurnResultKind.Succeeded, response);
    }

    private CoachingMoveRecord CreateRecord(
        Attempt attempt,
        string phase,
        CoachTurnEvent requestedEvent,
        CoachTurnResponse response)
    {
        (string moveKind, string? stepId, IReadOnlyList<string> provenanceFactIds) =
            response.Move switch
            {
                AskProbeResponse =>
                    (CoachContractNames.AskProbe, (string?)null,
                        (IReadOnlyList<string>)[]),
                RouteToStepResponse route =>
                    (CoachContractNames.RouteToStep, route.StepId, []),
                DiagnoseDifferenceResponse =>
                    (CoachContractNames.DiagnoseDifference, null, []),
                SuggestScaffoldResponse suggest =>
                    (CoachContractNames.SuggestScaffold, suggest.SuggestedStepId, []),
                ExplainWhyResponse explain =>
                    (CoachContractNames.ExplainWhy, null, explain.ProvenanceFactIds),
                AnswerQuestionResponse answer =>
                    (CoachContractNames.AnswerQuestion, answer.StepId, []),
                _ => throw new InvalidOperationException(
                    $"Unsupported coach move '{response.Move.GetType().Name}'.")
            };

        return new CoachingMoveRecord(
            RecordId: Guid.NewGuid().ToString("n"),
            AttemptId: attempt.Id.Value,
            PracticeItemId: attempt.PracticeItemId.Value,
            CheckCount: attempt.Checks.Count,
            Phase: phase,
            RequestedEvent: CoachContractNames.EventName(requestedEvent),
            MoveKind: moveKind,
            FocusPhraseIds: response.Move.FocusPhraseIds,
            SuggestedStepId: stepId,
            ProvenanceFactIds: provenanceFactIds,
            RecordedAt: timeProvider.GetUtcNow());
    }

    private static bool IsWellFormed(CoachTurnRequest request) =>
        request.Event switch
        {
            CoachTurnEvent.ProbeAnswered =>
                !string.IsNullOrWhiteSpace(request.Answer) &&
                request.Answer.Length <= MaxProbeAnswerLength &&
                request.StepId is null &&
                request.Question is null,
            CoachTurnEvent.StepQuestionAsked =>
                request.Answer is null &&
                !string.IsNullOrWhiteSpace(request.StepId) &&
                !string.IsNullOrWhiteSpace(request.Question) &&
                request.Question.Length <= MaxQuestionLength,
            _ =>
                request.Answer is null &&
                request.StepId is null &&
                request.Question is null
        };

    private static bool IsLegalEvent(
        object phase,
        CoachTurnEvent requestedEvent,
        CoachingPolicy policy) =>
        requestedEvent == CoachTurnEvent.StepQuestionAsked
            ? policy.HasScaffold
            : phase switch
        {
            BeforeCheck =>
                policy.Probe is not null &&
                requestedEvent is CoachTurnEvent.HelpRequested or CoachTurnEvent.ProbeAnswered,
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
            AskProbeResponse => CoachContractNames.AskProbe,
            RouteToStepResponse => CoachContractNames.RouteToStep,
            DiagnoseDifferenceResponse => CoachContractNames.DiagnoseDifference,
            SuggestScaffoldResponse => CoachContractNames.SuggestScaffold,
            ExplainWhyResponse => CoachContractNames.ExplainWhy,
            AnswerQuestionResponse => CoachContractNames.AnswerQuestion,
            _ => move.GetType().Name
        };
}
