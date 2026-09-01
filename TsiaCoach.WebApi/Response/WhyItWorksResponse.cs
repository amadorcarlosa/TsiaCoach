namespace TsiaCoach.WebApi.Response;

public sealed record WhyItWorksResponse(
    string AttemptId,
    string PracticeItemId,
    string SelectedAnswerId,
    int CheckCount,
    IReadOnlyList<LatentMathResponse> ProvenanceChain);
