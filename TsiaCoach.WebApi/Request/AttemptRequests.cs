using System.Text.Json.Serialization;

namespace TsiaCoach.WebApi.Request;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record StartAttemptRequest(string PracticeItemId);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record CheckAnswerRequest(string SelectedAnswerId);
