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

/// <param name="Evidence">
/// The learner's latest accepted submission on the current step, so a reload
/// resumes a half-built board. Null when the step has none yet. It is the
/// learner's own input and carries no verdict or solution data.
/// </param>
public sealed record ActiveScaffoldSessionResponse(
    ScaffoldLearnerStepResponse CurrentStep,
    ScaffoldStepEvidenceResponse? Evidence)
    : ScaffoldSessionStateResponse;

public sealed record CompletedScaffoldSessionResponse
    : ScaffoldSessionStateResponse;

public sealed record ScaffoldLearnerStepResponse(
    string Id,
    ScaffoldPromptResponse Prompt,
    ScaffoldSceneResponse Scene,
    LearnerActionResponse Action);

/// <param name="Outcome">
/// "complete" when the step's done condition was met, "accepted" when the
/// move was legal but the step is unfinished, "rejected" when the move broke
/// the rule and the browser should revert it.
/// </param>
public sealed record ScaffoldLastCheckResponse(
    string StepId,
    bool Satisfied,
    string Outcome);

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(PlacePiecesEvidenceResponse), "placePieces")]
[JsonDerivedType(typeof(MoveRowsEvidenceResponse), "moveRows")]
[JsonDerivedType(typeof(SelectRowsEvidenceResponse), "selectRows")]
public abstract record ScaffoldStepEvidenceResponse;

public sealed record PlacedPieceResponse(
    int Length,
    int X,
    int Y);

public sealed record PlacePiecesEvidenceResponse(
    IReadOnlyList<PlacedPieceResponse> Pieces)
    : ScaffoldStepEvidenceResponse;

public sealed record MoveRowsEvidenceResponse(
    IReadOnlyList<int> MovedRows)
    : ScaffoldStepEvidenceResponse;

public sealed record SelectRowsEvidenceResponse(
    IReadOnlyList<int> Rows)
    : ScaffoldStepEvidenceResponse;
