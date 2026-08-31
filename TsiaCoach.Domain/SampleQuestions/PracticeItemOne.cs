using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Mathematics;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.Text;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.SampleQuestions;

public static class PracticeItemOne
{
    public const string SourceText =
        "If n is the least of two consecutive odd integers, which of the following " +
        "represents the sum of the two integers?\n" +
        "A. n + 1\n" +
        "B. n + 2\n" +
        "C. 2n + 1\n" +
        "D. 2n + 2";

    private static readonly IReadOnlyList<TextToken> TokenDefinitions =
    [
        // Question stem
        new(new("t0"),  new(0),  "If",          TokenKind.Word),
        new(new("t1"),  new(1),  "n",           TokenKind.Symbol),
        new(new("t2"),  new(2),  "is",          TokenKind.Word),
        new(new("t3"),  new(3),  "the",         TokenKind.Word),
        new(new("t4"),  new(4),  "least",       TokenKind.Word),
        new(new("t5"),  new(5),  "of",          TokenKind.Word),
        new(new("t6"),  new(6),  "two",         TokenKind.Word),
        new(new("t7"),  new(7),  "consecutive", TokenKind.Word),
        new(new("t8"),  new(8),  "odd",         TokenKind.Word),
        new(new("t9"),  new(9),  "integers",    TokenKind.Word),
        new(new("t10"), new(10), ",",           TokenKind.Punctuation),
        new(new("t11"), new(11), "which",       TokenKind.Word),
        new(new("t12"), new(12), "of",          TokenKind.Word),
        new(new("t13"), new(13), "the",         TokenKind.Word),
        new(new("t14"), new(14), "following",   TokenKind.Word),
        new(new("t15"), new(15), "represents",  TokenKind.Word),
        new(new("t16"), new(16), "the",         TokenKind.Word),
        new(new("t17"), new(17), "sum",         TokenKind.Word),
        new(new("t18"), new(18), "of",          TokenKind.Word),
        new(new("t19"), new(19), "the",         TokenKind.Word),
        new(new("t20"), new(20), "two",         TokenKind.Word),
        new(new("t21"), new(21), "integers",    TokenKind.Word),
        new(new("t22"), new(22), "?",           TokenKind.Punctuation),

        // A. n + 1
        new(new("t23"), new(23), "A", TokenKind.Symbol),
        new(new("t24"), new(24), ".", TokenKind.Punctuation),
        new(new("t25"), new(25), "n", TokenKind.Symbol),
        new(new("t26"), new(26), "+", TokenKind.Symbol),
        new(new("t27"), new(27), "1", TokenKind.Number),

        // B. n + 2
        new(new("t28"), new(28), "B", TokenKind.Symbol),
        new(new("t29"), new(29), ".", TokenKind.Punctuation),
        new(new("t30"), new(30), "n", TokenKind.Symbol),
        new(new("t31"), new(31), "+", TokenKind.Symbol),
        new(new("t32"), new(32), "2", TokenKind.Number),

        // C. 2n + 1
        new(new("t33"), new(33), "C", TokenKind.Symbol),
        new(new("t34"), new(34), ".", TokenKind.Punctuation),
        new(new("t35"), new(35), "2", TokenKind.Number),
        new(new("t36"), new(36), "n", TokenKind.Symbol),
        new(new("t37"), new(37), "+", TokenKind.Symbol),
        new(new("t38"), new(38), "1", TokenKind.Number),

        // D. 2n + 2
        new(new("t39"), new(39), "D", TokenKind.Symbol),
        new(new("t40"), new(40), ".", TokenKind.Punctuation),
        new(new("t41"), new(41), "2", TokenKind.Number),
        new(new("t42"), new(42), "n", TokenKind.Symbol),
        new(new("t43"), new(43), "+", TokenKind.Symbol),
        new(new("t44"), new(44), "2", TokenKind.Number)
    ];

    public static readonly IReadOnlyList<SentenceSpan> Sentences =
    [
        new(
            Id: new("sent-0"),
            Span: new(
                Start: new(0),
                Length: 23
            )
        )
    ];

    public static readonly IReadOnlyList<PhraseSpan> Phrases =
    [
        new(
            Id: new("phrase-selector"),
            Span: new(
                Start: new(3),
                Length: 3
            )
        ), // "the least of"

        new(
            Id: new("phrase-set-declaration"),
            Span: new(
                Start: new(6),
                Length: 4
            )
        ), // "two consecutive odd integers"

        new(
            Id: new("phrase-answer-format"),
            Span: new(
                Start: new(11),
                Length: 4
            )
        ), // "which of the following"

        new(
            Id: new("phrase-representation"),
            Span: new(
                Start: new(15),
                Length: 1
            )
        ), // "represents"

        new(
            Id: new("phrase-target"),
            Span: new(
                Start: new(16),
                Length: 6
            )
        ), // "the sum of the two integers"
        new(
            Id: new("phrase-set-reference"),
            Span: new(
                Start: new(19),
                Length: 3
            )
        ), // "the two integers"
        new(
            Id: new("phrase-ordered-step"),
            Span: new(
                Start: new(7),
                Length: 3
            )
        ) // "consecutive odd integers"
    ];

    public static readonly TextStructure Text = TextStructure.Create(
        sourceText: SourceText,
        tokens: TokenDefinitions,
        sentences: Sentences,
        phrases: Phrases
    );

    public static IReadOnlyList<TextToken> TextTokens => Text.Tokens;

    public static readonly IReadOnlyList<AnswerChoice> Answers =
    [
        AnswerChoice.Create(
            id: new("answer-a"),
            labelSpan: new(new(23), 2),   // A.
            contentSpan: new(new(25), 3), // n + 1
            text: Text
        ),

        AnswerChoice.Create(
            id: new("answer-b"),
            labelSpan: new(new(28), 2),   // B.
            contentSpan: new(new(30), 3), // n + 2
            text: Text
        ),

        AnswerChoice.Create(
            id: new("answer-c"),
            labelSpan: new(new(33), 2),   // C.
            contentSpan: new(new(35), 4), // 2n + 1
            text: Text
        ),

        AnswerChoice.Create(
            id: new("answer-d"),
            labelSpan: new(new(39), 2),   // D.
            contentSpan: new(new(41), 4), // 2n + 2
            text: Text
        )
    ];

    private static readonly AuthoredAnswerMathematics AuthoredMathematics =
        SampleQuestionAuthoring.CreateAnswerMathematics(
            Text,
            [
                new(new("answer-a"), new("math-answer-a"), new(new(25), 3), new("symbol-n"), null, 1),
                new(new("answer-b"), new("math-answer-b"), new(new(30), 3), new("symbol-n"), null, 2),
                new(new("answer-c"), new("math-answer-c"), new(new(35), 4), new("symbol-n"), 2, 1),
                new(new("answer-d"), new("math-answer-d"), new(new(41), 4), new("symbol-n"), 2, 2)
            ]);

    private static readonly MathObject SecondMemberMathematics = new(
        Id: new("math-second-member"),
        RootNodeId: new("math-second-member-addition"),
        Nodes:
        [
            new(
                Id: new("math-second-member-variable"),
                Kind: MathNodeKind.SymbolReference,
                Value: "symbol-n",
                ChildNodeIds: []),
            new(
                Id: new("math-second-member-step"),
                Kind: MathNodeKind.IntegerLiteral,
                Value: "2",
                ChildNodeIds: []),
            new(
                Id: new("math-second-member-addition"),
                Kind: MathNodeKind.Addition,
                Value: null,
                ChildNodeIds:
                [
                    new("math-second-member-variable"),
                    new("math-second-member-step")
                ])
        ]
    );

    private static readonly MathObject RequestedValueComposedMathematics = new(
        Id: new("math-requested-value-composed"),
        RootNodeId: new("math-requested-value-composed-addition"),
        Nodes:
        [
            new(
                Id: new("math-requested-value-first-member"),
                Kind: MathNodeKind.SymbolReference,
                Value: "symbol-n",
                ChildNodeIds: []),
            new(
                Id: new("math-requested-value-second-variable"),
                Kind: MathNodeKind.SymbolReference,
                Value: "symbol-n",
                ChildNodeIds: []),
            new(
                Id: new("math-requested-value-ordered-step"),
                Kind: MathNodeKind.IntegerLiteral,
                Value: "2",
                ChildNodeIds: []),
            new(
                Id: new("math-requested-value-second-member"),
                Kind: MathNodeKind.Addition,
                Value: null,
                ChildNodeIds:
                [
                    new("math-requested-value-second-variable"),
                    new("math-requested-value-ordered-step")
                ]),
            new(
                Id: new("math-requested-value-composed-addition"),
                Kind: MathNodeKind.Addition,
                Value: null,
                ChildNodeIds:
                [
                    new("math-requested-value-first-member"),
                    new("math-requested-value-second-member")
                ])
        ]
    );

    public static readonly MathematicsModel Mathematics = new(
        Objects: AuthoredMathematics.Mathematics.Objects
            .Concat(
            [
                SecondMemberMathematics,
                RequestedValueComposedMathematics
            ])
            .ToArray(),
        TextBindings: AuthoredMathematics.Mathematics.TextBindings
    );

    public static readonly IReadOnlyList<AnswerMathBinding> AnswerMathBindings =
        AuthoredMathematics.AnswerBindings;

    public static readonly IReadOnlyDictionary<AnswerChoiceId, MisconceptionCode> Distractors =
        new Dictionary<AnswerChoiceId, MisconceptionCode>
        {
            { new("answer-a"), new("ordinary-step-and-missing-sum") },
            { new("answer-b"), new("stopped-at-second-integer") },
            { new("answer-c"), new("ordinary-step-in-sum") }
        };
    public static readonly VariableQuantity N = new(
        Id: new("entity-n"),
        SymbolId: new("symbol-n"),
        Name: new("n"),
        DeclaredByTokenId: new("t1")
    );

    public static readonly OrderedSet ConsecutiveOddIntegers = new(
        Id: new("entity-odd-pair"),
        DeclaredByPhraseId: new("phrase-set-declaration"),
        Cardinality: 2,
        Domain: IntegerDomain.OddIntegers
    );

    public static readonly SelectsElement NSelectsLeastElement = new(
        QuantityId: new("entity-n"),
        CollectionId: new("entity-odd-pair"),
        Selector: ElementSelector.Least,
        AnchoredByPhraseId: new("phrase-selector")
    );

    public static readonly RefersTo TwoIntegersReference = new(
        AnaphorPhraseId: new("phrase-set-reference"),
        ReferentId: new("entity-odd-pair")
    );

    public static readonly RequestsOperation SumRequest = new(
        RequestedByPhraseId: new("phrase-target"),
        Operation: OperationKind.Sum,
        OperandEntityId: new("entity-odd-pair")
    );

    public static readonly DerivedScalar OrderedStep = new(
        Id: new("latent-ordered-step"),
        Meaning: LatentScalarMeaning.OrderedStep,
        Value: 2,
        Provenance: new(
            Origin: LatentMathOrigin.ImplicitlyDerived,
            AnchorPhraseIds:
            [
                new("phrase-ordered-step")
            ],
            SourceEntityIds:
            [
                new("entity-odd-pair")
            ],
            SourceLatentMathIds: []
        )
    );

    public static readonly DerivedExpression SecondMember = new(
        Id: new("latent-second-member"),
        Meaning: LatentExpressionMeaning.QuantityDefinition,
        MathObjectId: new("math-second-member"),
        Provenance: new(
            Origin: LatentMathOrigin.ImplicitlyDerived,
            AnchorPhraseIds:
            [
                new("phrase-ordered-step")
            ],
            SourceEntityIds:
            [
                new("entity-n"),
                new("entity-odd-pair")
            ],
            SourceLatentMathIds:
            [
                new("latent-ordered-step")
            ]
        )
    );

    public static readonly DerivedScalar LikeTermCount = new(
        Id: new("latent-like-term-count"),
        Meaning: LatentScalarMeaning.LikeTermCount,
        Value: 2,
        Provenance: new(
            Origin: LatentMathOrigin.ImplicitlyDerived,
            AnchorPhraseIds:
            [
                new("phrase-set-declaration")
            ],
            SourceEntityIds:
            [
                new("entity-odd-pair")
            ],
            SourceLatentMathIds: []
        )
    );

    public static readonly DerivedExpression RequestedValueComposed = new(
        Id: new("latent-requested-value-composed"),
        Meaning: LatentExpressionMeaning.RequestedValueComposed,
        MathObjectId: new("math-requested-value-composed"),
        Provenance: new(
            Origin: LatentMathOrigin.Computed,
            AnchorPhraseIds:
            [
                new("phrase-target")
            ],
            SourceEntityIds:
            [
                new("entity-n"),
                new("entity-odd-pair")
            ],
            SourceLatentMathIds:
            [
                new("latent-second-member")
            ]
        )
    );

    public static readonly DerivedExpression RequestedValueSimplified = new(
        Id: new("latent-requested-value-simplified"),
        Meaning: LatentExpressionMeaning.RequestedValueSimplified,
        MathObjectId: new("math-answer-d"),
        Provenance: new(
            Origin: LatentMathOrigin.Computed,
            AnchorPhraseIds:
            [
                new("phrase-target")
            ],
            SourceEntityIds:
            [
                new("entity-odd-pair")
            ],
            SourceLatentMathIds:
            [
                new("latent-requested-value-composed"),
                new("latent-like-term-count"),
                new("latent-ordered-step")
            ]
        )
    );

    public static readonly SemanticModel Semantics = new(
        Entities:
        [
            N,
            ConsecutiveOddIntegers
        ],
        Edges:
        [
            NSelectsLeastElement,
            TwoIntegersReference,
            SumRequest
        ],
        LatentFacts:
        [
            OrderedStep,
            SecondMember,
            LikeTermCount,
            RequestedValueComposed,
            RequestedValueSimplified
        ]
    );
    public static readonly PracticeItemId Id = new("practice-item-sample-1");

    public static readonly PracticeItem Item = PracticeItem.Create(
        id: Id,
        text: Text,
        semantics: Semantics,
        mathematics: Mathematics,
        answers: Answers,
        answerMathBindings: AnswerMathBindings,
        correctAnswerId: new("answer-d"),
        distractors: Distractors
    );
}
