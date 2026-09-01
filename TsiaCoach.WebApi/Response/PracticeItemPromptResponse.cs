namespace TsiaCoach.WebApi.Response;

public sealed record PracticeItemPromptResponse(
    string Id,
    TextStructureResponse Text,
    PromptSemanticModelResponse Semantics,
    MathematicsResponse Mathematics,
    PromptMultipleChoiceInteractionResponse Interaction);

public sealed record PromptSemanticModelResponse(
    IReadOnlyList<SemanticEntityResponse> Entities,
    IReadOnlyList<SemanticEdgeResponse> Edges);

public sealed record PromptMultipleChoiceInteractionResponse(
    IReadOnlyList<AnswerChoiceResponse> Answers,
    IReadOnlyList<AnswerMathBindingResponse> AnswerMathBindings);
