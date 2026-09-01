namespace TsiaCoach.Domain.Scaffolds.Evaluation;

public sealed record ScaffoldStepSatisfied;

public sealed record ScaffoldStepNotSatisfied;

public union ScaffoldStepEvaluation(
    ScaffoldStepSatisfied,
    ScaffoldStepNotSatisfied);
