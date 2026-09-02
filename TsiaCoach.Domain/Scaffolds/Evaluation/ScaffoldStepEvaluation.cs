namespace TsiaCoach.Domain.Scaffolds.Evaluation;

/// <summary>The step's done condition is met. The session advances.</summary>
public sealed record ScaffoldStepSatisfied;

/// <summary>
/// The submission is legal but the step is not finished. The session stays
/// on the step and the submission becomes its current evidence.
/// </summary>
public sealed record ScaffoldStepAccepted;

/// <summary>
/// The submission breaks the step's rule, or does not meet a one-shot done
/// condition. The session stays on the step; the browser reverts the move.
/// </summary>
public sealed record ScaffoldStepNotSatisfied;

public union ScaffoldStepEvaluation(
    ScaffoldStepSatisfied,
    ScaffoldStepAccepted,
    ScaffoldStepNotSatisfied);
