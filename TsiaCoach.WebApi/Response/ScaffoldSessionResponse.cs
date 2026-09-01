using System.Text.Json.Serialization;

namespace TsiaCoach.WebApi.Response;

public sealed record ScaffoldSessionResponse(
    string SessionId,
    string AttemptId,
    string PracticeItemId,
    string ScaffoldId,
    string EntryStepId,
    int CheckCount,
    int CompletedStepCount,
    int TotalStepCount,
    IReadOnlyList<ScaffoldLearnerResourceResponse> Resources,
    ScaffoldSessionStateResponse State,
    ScaffoldLastCheckResponse? LastCheck);

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(ScaffoldLearnerRodResourceResponse), "rodResource")]
[JsonDerivedType(typeof(ScaffoldLearnerRodSeriesResourceResponse), "rodSeriesResource")]
public abstract record ScaffoldLearnerResourceResponse;

public sealed record ScaffoldLearnerRodResourceResponse(
    string Id,
    int Length,
    string Multiplicity,
    string Role)
    : ScaffoldLearnerResourceResponse;

public sealed record ScaffoldLearnerRodSeriesResourceResponse(
    string Id,
    IReadOnlyList<int> Lengths)
    : ScaffoldLearnerResourceResponse;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(ActiveScaffoldSessionResponse), "active")]
[JsonDerivedType(typeof(CompletedScaffoldSessionResponse), "completed")]
public abstract record ScaffoldSessionStateResponse;

public sealed record ActiveScaffoldSessionResponse(
    ScaffoldLearnerStepResponse CurrentStep)
    : ScaffoldSessionStateResponse;

public sealed record CompletedScaffoldSessionResponse
    : ScaffoldSessionStateResponse;

public sealed record ScaffoldLearnerStepResponse(
    string Id,
    ScaffoldPromptResponse Prompt,
    ScaffoldSceneResponse Scene,
    LearnerActionResponse Action);

public sealed record ScaffoldLastCheckResponse(
    string StepId,
    bool Satisfied);
