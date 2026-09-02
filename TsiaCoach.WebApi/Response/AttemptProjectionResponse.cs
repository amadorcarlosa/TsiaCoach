using System.Text.Json.Serialization;

namespace TsiaCoach.WebApi.Response;

public sealed record AttemptProjectionResponse(
    string AttemptId,
    string PracticeItemId,
    int CheckCount,
    AttemptPhaseResponse Phase,
    CoachingButtonResponse CoachingButton);

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(BeforeCheckResponse), "beforeCheck")]
[JsonDerivedType(typeof(AfterIncorrectCheckResponse), "afterIncorrectCheck")]
[JsonDerivedType(typeof(AfterCorrectCheckResponse), "afterCorrectCheck")]
public abstract record AttemptPhaseResponse;

public sealed record BeforeCheckResponse : AttemptPhaseResponse;

public sealed record AfterIncorrectCheckResponse(
    string SelectedAnswerId,
    string MisconceptionCode,
    string? Purpose,
    CoachingRouteResponse Route,
    int RouteStreak,
    string HintLevel) : AttemptPhaseResponse;

public sealed record AfterCorrectCheckResponse(string SelectedAnswerId) : AttemptPhaseResponse;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(VisibleCoachingButtonResponse), "visible")]
[JsonDerivedType(typeof(HiddenCoachingButtonResponse), "hidden")]
public abstract record CoachingButtonResponse;

public sealed record VisibleCoachingButtonResponse(string Label) : CoachingButtonResponse;

public sealed record HiddenCoachingButtonResponse : CoachingButtonResponse;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(ScaffoldEntryRouteResponse), "scaffoldEntry")]
[JsonDerivedType(typeof(NoScaffoldAuthoredRouteResponse), "noScaffoldAuthored")]
public abstract record CoachingRouteResponse;

public sealed record ScaffoldEntryRouteResponse(
    string ScaffoldId,
    string EntryStepId) : CoachingRouteResponse;

public sealed record NoScaffoldAuthoredRouteResponse : CoachingRouteResponse;
