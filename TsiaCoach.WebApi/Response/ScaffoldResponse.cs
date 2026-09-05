using System.Text.Json.Serialization;

namespace TsiaCoach.WebApi.Response;

public sealed record ScaffoldResponse(
    string Id,
    string PracticeItemId,
    IReadOnlyList<ScaffoldResourceResponse> Resources,
    IReadOnlyList<ScaffoldStepResponse> Steps
);

public sealed record ScaffoldStepResponse(
    string Id,
    string Purpose,
    bool EntryOnly,
    ScaffoldPromptResponse Prompt,
    ScaffoldSceneResponse Scene,
    LearnerActionResponse Action,
    SuccessCheckResponse SuccessCheck
);

public sealed record ScaffoldPromptResponse(
    string Text,
    IReadOnlyList<string> FocusPhraseIds
);

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(RodResourceResponse), "rodResource")]
[JsonDerivedType(typeof(RodSeriesResourceResponse), "rodSeriesResource")]
public abstract record ScaffoldResourceResponse;

public sealed record RodResourceResponse(
    string Id,
    LengthSourceResponse Length,
    string Multiplicity,
    string Role
) : ScaffoldResourceResponse;

public sealed record RodSeriesResourceResponse(
    string Id,
    IReadOnlyList<int> Lengths
) : ScaffoldResourceResponse;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(LiteralLengthResponse), "literalLength")]
[JsonDerivedType(typeof(LatentLengthReferenceResponse), "latentLengthReference")]
public abstract record LengthSourceResponse;

public sealed record LiteralLengthResponse(
    int Value
) : LengthSourceResponse;

public sealed record LatentLengthReferenceResponse(
    string LatentMathId
) : LengthSourceResponse;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(RodEquivalenceSceneResponse), "rodEquivalenceScene")]
[JsonDerivedType(typeof(RodMeasurementSceneResponse), "rodMeasurementScene")]
[JsonDerivedType(typeof(RodGapSceneResponse), "rodGapScene")]
[JsonDerivedType(typeof(QuantityJoinSceneResponse), "quantityJoinScene")]
[JsonDerivedType(typeof(AnswerChoiceSceneResponse), "answerChoiceScene")]
[JsonDerivedType(typeof(GridSceneResponse), "gridScene")]
public abstract record ScaffoldSceneResponse;

public sealed record RodEquivalenceSceneResponse(
    string UnitRodId,
    string ProbeRodId
) : ScaffoldSceneResponse;

public sealed record RodMeasurementSceneResponse(
    string ProbeRodId,
    string SpanSeriesId
) : ScaffoldSceneResponse;

public sealed record RodGapSceneResponse(
    string StepRodId,
    string SpanSeriesId,
    string IncludedOutcome
) : ScaffoldSceneResponse;

public sealed record QuantityJoinSceneResponse(
    IReadOnlyList<QuantityReferenceResponse> Parts,
    IReadOnlyList<InstructionalBindingResponse> Bindings,
    bool ShowSizedTarget
) : ScaffoldSceneResponse;

public sealed record AnswerChoiceSceneResponse : ScaffoldSceneResponse;

public sealed record GridPieceResponse(
    string Kind,
    int Length,
    int X,
    int Y,
    string? Symbol,
    string Orientation
);

public sealed record GridRowResponse(
    int Y,
    int Start,
    int Length
);

public sealed record GridSceneResponse(
    int Cols,
    int Rows,
    IReadOnlyList<GridPieceResponse> Reference,
    IReadOnlyList<GridRowResponse> TargetRows,
    bool UnitLines
) : ScaffoldSceneResponse;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(SemanticQuantityReferenceResponse), "semanticQuantityReference")]
[JsonDerivedType(typeof(LatentExpressionReferenceResponse), "latentExpressionReference")]
public abstract record QuantityReferenceResponse;

public sealed record SemanticQuantityReferenceResponse(
    string SemanticEntityId
) : QuantityReferenceResponse;

public sealed record LatentExpressionReferenceResponse(
    string LatentMathId
) : QuantityReferenceResponse;

public sealed record InstructionalBindingResponse(
    string SemanticEntityId,
    int Value
);

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(MatchEquivalentLengthActionResponse), "matchEquivalentLength")]
[JsonDerivedType(typeof(ClassifyByFitActionResponse), "classifyByFit")]
[JsonDerivedType(typeof(NameFitClassificationActionResponse), "nameFitClassification")]
[JsonDerivedType(typeof(TraverseAllGapsActionResponse), "traverseAllGaps")]
[JsonDerivedType(typeof(JoinQuantitiesActionResponse), "joinQuantities")]
[JsonDerivedType(typeof(EnterScalarActionResponse), "enterScalar")]
[JsonDerivedType(typeof(BuildExpressionActionResponse), "buildExpression")]
[JsonDerivedType(typeof(SelectAnswerChoiceActionResponse), "selectAnswerChoice")]
[JsonDerivedType(typeof(PlacePiecesActionResponse), "placePieces")]
[JsonDerivedType(typeof(MoveRowsActionResponse), "moveRows")]
[JsonDerivedType(typeof(SelectRowsActionResponse), "selectRows")]
public abstract record LearnerActionResponse;

public sealed record MatchEquivalentLengthActionResponse : LearnerActionResponse;
public sealed record ClassifyByFitActionResponse : LearnerActionResponse;

public sealed record NameFitClassificationActionResponse(
    string Classification
) : LearnerActionResponse;

public sealed record TraverseAllGapsActionResponse : LearnerActionResponse;
public sealed record JoinQuantitiesActionResponse : LearnerActionResponse;

public sealed record EnterScalarActionResponse(
    string Reading
) : LearnerActionResponse;

public sealed record BuildExpressionActionResponse : LearnerActionResponse;
public sealed record SelectAnswerChoiceActionResponse : LearnerActionResponse;

public sealed record PlacePiecesActionResponse(
    IReadOnlyList<int> AllowedLengths
) : LearnerActionResponse;

public sealed record MoveRowsActionResponse(
    int CompareColumn
) : LearnerActionResponse;

public sealed record SelectRowsActionResponse : LearnerActionResponse;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(LengthsAreEquivalentCheckResponse), "lengthsAreEquivalent")]
[JsonDerivedType(typeof(MatchesComputedFitCheckResponse), "matchesComputedFit")]
[JsonDerivedType(typeof(MatchesIntegerDomainCheckResponse), "matchesIntegerDomain")]
[JsonDerivedType(typeof(AllGapsTraversedCheckResponse), "allGapsTraversed")]
[JsonDerivedType(typeof(MatchesPartCompositionCheckResponse), "matchesPartComposition")]
[JsonDerivedType(typeof(MatchesLatentScalarCheckResponse), "matchesLatentScalar")]
[JsonDerivedType(typeof(MatchesLatentExpressionCheckResponse), "matchesLatentExpression")]
[JsonDerivedType(typeof(MatchesCorrectAnswerCheckResponse), "matchesCorrectAnswer")]
[JsonDerivedType(typeof(MatchesRowCompositionsCheckResponse), "matchesRowCompositions")]
[JsonDerivedType(typeof(MatchesRowPartitionCheckResponse), "matchesRowPartition")]
[JsonDerivedType(typeof(MatchesRowSelectionCheckResponse), "matchesRowSelection")]
public abstract record SuccessCheckResponse;

public sealed record LengthsAreEquivalentCheckResponse : SuccessCheckResponse;
public sealed record MatchesComputedFitCheckResponse : SuccessCheckResponse;

public sealed record MatchesIntegerDomainCheckResponse(
    string Classification,
    string Domain
) : SuccessCheckResponse;

public sealed record AllGapsTraversedCheckResponse(
    string RequiredResourceId
) : SuccessCheckResponse;

public sealed record MatchesPartCompositionCheckResponse : SuccessCheckResponse;

public sealed record MatchesLatentScalarCheckResponse(
    string ExpectedValueId,
    string Reading
) : SuccessCheckResponse;

public sealed record MatchesLatentExpressionCheckResponse(
    string ExpectedExpressionId
) : SuccessCheckResponse;

public sealed record MatchesCorrectAnswerCheckResponse : SuccessCheckResponse;

public sealed record MatchesRowCompositionsCheckResponse(
    int StepLength
) : SuccessCheckResponse;

public sealed record MatchesRowPartitionCheckResponse(
    IReadOnlyList<int> ExpectedMovedRows
) : SuccessCheckResponse;

public sealed record MatchesRowSelectionCheckResponse(
    IReadOnlyList<int> SelectableRows,
    int RequiredCount,
    string Rule,
    IReadOnlyList<int> ExpectedRows
) : SuccessCheckResponse;
