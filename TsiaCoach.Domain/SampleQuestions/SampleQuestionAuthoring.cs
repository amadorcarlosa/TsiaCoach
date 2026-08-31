using System.Globalization;
using TsiaCoach.Domain.Mathematics;
using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Text;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.SampleQuestions;

internal sealed record LinearAnswerSpec(
    AnswerChoiceId AnswerChoiceId,
    MathObjectId MathObjectId,
    TokenSpan ContentSpan,
    SymbolId SymbolId,
    int? Coefficient,
    int? Constant
);

internal sealed record AuthoredAnswerMathematics(
    MathematicsModel Mathematics,
    IReadOnlyList<AnswerMathBinding> AnswerBindings
);

internal static class SampleQuestionAuthoring
{
    public static AuthoredAnswerMathematics CreateAnswerMathematics(
        TextStructure text,
        IReadOnlyList<LinearAnswerSpec> answers)
    {
        var objects = new List<MathObject>();
        var textBindings = new List<MathTextBinding>();
        var answerBindings = new List<AnswerMathBinding>();

        foreach (LinearAnswerSpec answer in answers)
        {
            AddLinearExpression(
                text,
                answer,
                objects,
                textBindings,
                answerBindings);
        }

        return new(
            Mathematics: new(objects, textBindings),
            AnswerBindings: answerBindings);
    }

    private static void AddLinearExpression(
        TextStructure text,
        LinearAnswerSpec answer,
        ICollection<MathObject> objects,
        ICollection<MathTextBinding> textBindings,
        ICollection<AnswerMathBinding> answerBindings)
    {
        string prefix = answer.MathObjectId.Value;
        var nodes = new List<MathNode>();
        int tokenIndex = answer.ContentSpan.Start.Value;

        MathNodeId? coefficientId = null;

        if (answer.Coefficient is int coefficient)
        {
            coefficientId = new($"{prefix}-coefficient");
            nodes.Add(new(
                Id: coefficientId.Value,
                Kind: MathNodeKind.IntegerLiteral,
                Value: coefficient.ToString(CultureInfo.InvariantCulture),
                ChildNodeIds: []));
            textBindings.Add(NodeBinding(
                text,
                answer.MathObjectId,
                coefficientId.Value,
                tokenIndex));
            tokenIndex++;
        }

        var variableId = new MathNodeId($"{prefix}-variable");
        nodes.Add(new(
            Id: variableId,
            Kind: MathNodeKind.SymbolReference,
            Value: answer.SymbolId.Value,
            ChildNodeIds: []));
        textBindings.Add(NodeBinding(
            text,
            answer.MathObjectId,
            variableId,
            tokenIndex));
        tokenIndex++;

        MathNodeId leftId = variableId;

        if (coefficientId is MathNodeId coefficientNodeId)
        {
            var productId = new MathNodeId($"{prefix}-product");
            nodes.Add(new(
                Id: productId,
                Kind: MathNodeKind.Multiplication,
                Value: null,
                ChildNodeIds: [coefficientNodeId, variableId]));
            textBindings.Add(new(
                MathObjectId: answer.MathObjectId,
                MathNodeId: productId,
                CharacterSpan: text.CharacterSpanFor(new(
                    Start: answer.ContentSpan.Start,
                    Length: 2))));
            leftId = productId;
        }

        MathNodeId rootId = leftId;

        if (answer.Constant is int constant)
        {
            var additionId = new MathNodeId($"{prefix}-addition");
            CharacterSpan leftSpan = text.CharacterSpanFor(new(
                Start: answer.ContentSpan.Start,
                Length: answer.Coefficient is null ? 1 : 2));
            CharacterSpan constantSpan = text.Tokens[tokenIndex + 1].CharacterSpan;
            textBindings.Add(new(
                MathObjectId: answer.MathObjectId,
                MathNodeId: additionId,
                CharacterSpan: new(
                    Start: leftSpan.End,
                    Length: constantSpan.Start - leftSpan.End)));

            var constantId = new MathNodeId($"{prefix}-constant");
            nodes.Add(new(
                Id: constantId,
                Kind: MathNodeKind.IntegerLiteral,
                Value: constant.ToString(CultureInfo.InvariantCulture),
                ChildNodeIds: []));
            textBindings.Add(NodeBinding(
                text,
                answer.MathObjectId,
                constantId,
                tokenIndex + 1));

            nodes.Add(new(
                Id: additionId,
                Kind: MathNodeKind.Addition,
                Value: null,
                ChildNodeIds: [leftId, constantId]));
            rootId = additionId;
        }

        objects.Add(new(
            Id: answer.MathObjectId,
            RootNodeId: rootId,
            Nodes: nodes));
        textBindings.Add(new(
            MathObjectId: answer.MathObjectId,
            MathNodeId: null,
            CharacterSpan: text.CharacterSpanFor(answer.ContentSpan)));
        answerBindings.Add(new(
            AnswerChoiceId: answer.AnswerChoiceId,
            MathObjectId: answer.MathObjectId));
    }

    private static MathTextBinding NodeBinding(
        TextStructure text,
        MathObjectId objectId,
        MathNodeId nodeId,
        int tokenIndex) =>
        new(
            MathObjectId: objectId,
            MathNodeId: nodeId,
            CharacterSpan: text.Tokens[tokenIndex].CharacterSpan);
}
