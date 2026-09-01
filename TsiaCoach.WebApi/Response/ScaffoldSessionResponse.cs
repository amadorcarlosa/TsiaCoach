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
    IReadOnlyList<ScaffoldResourceResponse> Resources,
    ScaffoldSessionStateResponse State,
    ScaffoldLastCheckResponse? LastCheck);

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
    StepSceneResponse Scene,
    LearnerActionResponse Action);

public sealed record ScaffoldLastCheckResponse(
    string StepId,
    bool Satisfied);
