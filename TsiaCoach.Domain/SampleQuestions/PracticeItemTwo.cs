using TsiaCoach.Domain.PracticeItems;
using TsiaCoach.Domain.Semantics;
using TsiaCoach.Domain.Text;
using TsiaCoach.Domain.ValueObjects;

namespace TsiaCoach.Domain.SampleQuestions;

public static class PracticeItemTwo
{
    public static readonly IReadOnlyList<TextToken> TextTokens =
    [
        // Sentence 0: "Last year, a bakery sold w loaves of bread."
        new(new("t0"),  new(0),  "Last",    TokenKind.Word),
        new(new("t1"),  new(1),  "year",    TokenKind.Word),
        new(new("t2"),  new(2),  ",",       TokenKind.Punctuation),
        new(new("t3"),  new(3),  "a",       TokenKind.Word),
        new(new("t4"),  new(4),  "bakery",  TokenKind.Word),
        new(new("t5"),  new(5),  "sold",    TokenKind.Word),
        new(new("t6"),  new(6),  "w",       TokenKind.Symbol),
        new(new("t7"),  new(7),  "loaves",  TokenKind.Word),
        new(new("t8"),  new(8),  "of",      TokenKind.Word),
        new(new("t9"),  new(9),  "bread",   TokenKind.Word),
        new(new("t10"), new(10), ".",       TokenKind.Punctuation),

        // Sentence 1: "This year, the bakery sold three more than twice the
        //              number of loaves of bread sold last year."
        new(new("t11"), new(11), "This",    TokenKind.Word),
        new(new("t12"), new(12), "year",    TokenKind.Word),
        new(new("t13"), new(13), ",",       TokenKind.Punctuation),
        new(new("t14"), new(14), "the",     TokenKind.Word),
        new(new("t15"), new(15), "bakery",  TokenKind.Word),
        new(new("t16"), new(16), "sold",    TokenKind.Word),
        new(new("t17"), new(17), "three",   TokenKind.Word),
        new(new("t18"), new(18), "more",    TokenKind.Word),
        new(new("t19"), new(19), "than",    TokenKind.Word),
        new(new("t20"), new(20), "twice",   TokenKind.Word),
        new(new("t21"), new(21), "the",     TokenKind.Word),
        new(new("t22"), new(22), "number",  TokenKind.Word),
        new(new("t23"), new(23), "of",      TokenKind.Word),
        new(new("t24"), new(24), "loaves",  TokenKind.Word),
        new(new("t25"), new(25), "of",      TokenKind.Word),
        new(new("t26"), new(26), "bread",   TokenKind.Word),
        new(new("t27"), new(27), "sold",    TokenKind.Word),
        new(new("t28"), new(28), "last",    TokenKind.Word),
        new(new("t29"), new(29), "year",    TokenKind.Word),
        new(new("t30"), new(30), ".",       TokenKind.Punctuation),

        // Sentence 2: "If next year the bakery plans on selling twice the number
        //              of loaves of bread sold this year, how many loaves of bread
        //              does the bakery expect to sell next year?"
        new(new("t31"), new(31), "If",      TokenKind.Word),
        new(new("t32"), new(32), "next",    TokenKind.Word),
        new(new("t33"), new(33), "year",    TokenKind.Word),
        new(new("t34"), new(34), "the",     TokenKind.Word),
        new(new("t35"), new(35), "bakery",  TokenKind.Word),
        new(new("t36"), new(36), "plans",   TokenKind.Word),
        new(new("t37"), new(37), "on",      TokenKind.Word),
        new(new("t38"), new(38), "selling", TokenKind.Word),
        new(new("t39"), new(39), "twice",   TokenKind.Word),
        new(new("t40"), new(40), "the",     TokenKind.Word),
        new(new("t41"), new(41), "number",  TokenKind.Word),
        new(new("t42"), new(42), "of",      TokenKind.Word),
        new(new("t43"), new(43), "loaves",  TokenKind.Word),
        new(new("t44"), new(44), "of",      TokenKind.Word),
        new(new("t45"), new(45), "bread",   TokenKind.Word),
        new(new("t46"), new(46), "sold",    TokenKind.Word),
        new(new("t47"), new(47), "this",    TokenKind.Word),
        new(new("t48"), new(48), "year",    TokenKind.Word),
        new(new("t49"), new(49), ",",       TokenKind.Punctuation),
        new(new("t50"), new(50), "how",     TokenKind.Word),
        new(new("t51"), new(51), "many",    TokenKind.Word),
        new(new("t52"), new(52), "loaves",  TokenKind.Word),
        new(new("t53"), new(53), "of",      TokenKind.Word),
        new(new("t54"), new(54), "bread",   TokenKind.Word),
        new(new("t55"), new(55), "does",    TokenKind.Word),
        new(new("t56"), new(56), "the",     TokenKind.Word),
        new(new("t57"), new(57), "bakery",  TokenKind.Word),
        new(new("t58"), new(58), "expect",  TokenKind.Word),
        new(new("t59"), new(59), "to",      TokenKind.Word),
        new(new("t60"), new(60), "sell",    TokenKind.Word),
        new(new("t61"), new(61), "next",    TokenKind.Word),
        new(new("t62"), new(62), "year",    TokenKind.Word),
        new(new("t63"), new(63), "?",       TokenKind.Punctuation),

        // A. 2w
        new(new("t64"), new(64), "A", TokenKind.Symbol),
        new(new("t65"), new(65), ".", TokenKind.Punctuation),
        new(new("t66"), new(66), "2", TokenKind.Number),
        new(new("t67"), new(67), "w", TokenKind.Symbol),

        // B. 2w + 3
        new(new("t68"), new(68), "B", TokenKind.Symbol),
        new(new("t69"), new(69), ".", TokenKind.Punctuation),
        new(new("t70"), new(70), "2", TokenKind.Number),
        new(new("t71"), new(71), "w", TokenKind.Symbol),
        new(new("t72"), new(72), "+", TokenKind.Symbol),
        new(new("t73"), new(73), "3", TokenKind.Number),

        // C. 4w + 3
        new(new("t74"), new(74), "C", TokenKind.Symbol),
        new(new("t75"), new(75), ".", TokenKind.Punctuation),
        new(new("t76"), new(76), "4", TokenKind.Number),
        new(new("t77"), new(77), "w", TokenKind.Symbol),
        new(new("t78"), new(78), "+", TokenKind.Symbol),
        new(new("t79"), new(79), "3", TokenKind.Number),

        // D. 4w + 6
        new(new("t80"), new(80), "D", TokenKind.Symbol),
        new(new("t81"), new(81), ".", TokenKind.Punctuation),
        new(new("t82"), new(82), "4", TokenKind.Number),
        new(new("t83"), new(83), "w", TokenKind.Symbol),
        new(new("t84"), new(84), "+", TokenKind.Symbol),
        new(new("t85"), new(85), "6", TokenKind.Number)
    ];

    public static readonly IReadOnlyList<SentenceSpan> Sentences =
    [
        new(
            Id: new("sent-0"),
            Span: new(
                Start: new(0),
                Length: 11
            )
        ), // "Last year, a bakery sold w loaves of bread."

        new(
            Id: new("sent-1"),
            Span: new(
                Start: new(11),
                Length: 20
            )
        ), // "This year, the bakery sold three more than twice ... sold last year."

        new(
            Id: new("sent-2"),
            Span: new(
                Start: new(31),
                Length: 33
            )
        ) // "If next year the bakery plans on selling ... to sell next year?"
    ];

    public static readonly IReadOnlyList<PhraseSpan> Phrases =
    [
        new(
            Id: new("phrase-baseline-declaration"),
            Span: new(
                Start: new(0),
                Length: 10
            )
        ), // "Last year, a bakery sold w loaves of bread"

        new(
            Id: new("phrase-baseline-quantity"),
            Span: new(
                Start: new(6),
                Length: 4
            )
        ), // "w loaves of bread"

        // this year = (last year x 2) + 3
        // Surface order is increment-first; build order is scale-first.
        new(
            Id: new("phrase-this-year-relation"),
            Span: new(
                Start: new(17),
                Length: 13
            )
        ), // "three more than twice the number of loaves of bread sold last year"

        new(
            Id: new("phrase-this-year-increment"),
            Span: new(
                Start: new(17),
                Length: 3
            )
        ), // "three more than"

        new(
            Id: new("phrase-this-year-scale"),
            Span: new(
                Start: new(20),
                Length: 1
            )
        ), // "twice"

        new(
            Id: new("phrase-last-year-reference"),
            Span: new(
                Start: new(21),
                Length: 9
            )
        ), // "the number of loaves of bread sold last year"

        // next year = this year x 2
        new(
            Id: new("phrase-next-year-relation"),
            Span: new(
                Start: new(39),
                Length: 10
            )
        ), // "twice the number of loaves of bread sold this year"

        new(
            Id: new("phrase-next-year-scale"),
            Span: new(
                Start: new(39),
                Length: 1
            )
        ), // "twice"

        new(
            Id: new("phrase-this-year-reference"),
            Span: new(
                Start: new(40),
                Length: 9
            )
        ), // "the number of loaves of bread sold this year"

        new(
            Id: new("phrase-target"),
            Span: new(
                Start: new(50),
                Length: 13
            )
        ) // "how many loaves of bread does the bakery expect to sell next year"
    ];

    public static readonly TextStructure Text = new(
        Tokens: TextTokens,
        Sentences: Sentences,
        Phrases: Phrases
    );

    public static readonly IReadOnlyList<AnswerChoice> Answers =
    [
        new(
            Id: new("answer-a"),
            LabelSpan: new(new(64), 2),   // A.
            ContentSpan: new(new(66), 2)  // 2w
        ),

        new(
            Id: new("answer-b"),
            LabelSpan: new(new(68), 2),   // B.
            ContentSpan: new(new(70), 4)  // 2w + 3
        ),

        new(
            Id: new("answer-c"),
            LabelSpan: new(new(74), 2),   // C.
            ContentSpan: new(new(76), 4)  // 4w + 3
        ),

        new(
            Id: new("answer-d"),
            LabelSpan: new(new(80), 2),   // D.
            ContentSpan: new(new(82), 4)  // 4w + 6
        )
    ];

    public static readonly VariableQuantity W = new(
        Id: new("entity-w"),
        SymbolId: new("symbol-w"),
        Name: new("w"),
        DeclaredByTokenId: new("t6")
    );

    public static readonly DerivedQuantity ThisYear = new(
        Id: new("entity-this-year"),
        DeclaredBySentenceId: new("sent-1")
    );

    public static readonly DerivedQuantity NextYear = new(
        Id: new("entity-next-year"),
        DeclaredBySentenceId: new("sent-2")
    );

    public static readonly DerivedScalar ThisYearScaleFactor = new(
        Id: new("latent-this-year-scale"),
        Meaning: LatentScalarMeaning.ScaleFactor,
        Value: 2,
        Provenance: new(
            Origin: LatentMathOrigin.EncodedBySurfacePhrase,
            AnchorPhraseIds:
            [
                new("phrase-this-year-scale")
            ],
            SourceEntityIds: [],
            SourceLatentMathIds: []
        )
    );

    public static readonly DerivedScalar ThisYearIncrement = new(
        Id: new("latent-this-year-increment"),
        Meaning: LatentScalarMeaning.Increment,
        Value: 3,
        Provenance: new(
            Origin: LatentMathOrigin.EncodedBySurfacePhrase,
            AnchorPhraseIds:
            [
                new("phrase-this-year-increment")
            ],
            SourceEntityIds: [],
            SourceLatentMathIds: []
        )
    );

    public static readonly DerivedScalar NextYearScaleFactor = new(
        Id: new("latent-next-year-scale"),
        Meaning: LatentScalarMeaning.ScaleFactor,
        Value: 2,
        Provenance: new(
            Origin: LatentMathOrigin.EncodedBySurfacePhrase,
            AnchorPhraseIds:
            [
                new("phrase-next-year-scale")
            ],
            SourceEntityIds: [],
            SourceLatentMathIds: []
        )
    );

    // this year = (w x 2) + 3
    // Build order is scale-then-increment; the surface states the increment first.
    public static readonly DerivesFrom ThisYearDerivation = new(
        TargetEntityId: new("entity-this-year"),
        SourceEntityId: new("entity-w"),
        OperationsInBuildOrder:
        [
            new ScaleBy(
                AnchoredByPhraseId: new("phrase-this-year-scale"),
                ScaleFactorId: new("latent-this-year-scale")
            ),
            new IncrementBy(
                AnchoredByPhraseId: new("phrase-this-year-increment"),
                IncrementId: new("latent-this-year-increment")
            )
        ]
    );

    // next year = this year x 2
    public static readonly DerivesFrom NextYearDerivation = new(
        TargetEntityId: new("entity-next-year"),
        SourceEntityId: new("entity-this-year"),
        OperationsInBuildOrder:
        [
            new ScaleBy(
                AnchoredByPhraseId: new("phrase-next-year-scale"),
                ScaleFactorId: new("latent-next-year-scale")
            )
        ]
    );

    public static readonly RefersTo LastYearReference = new(
        AnaphorPhraseId: new("phrase-last-year-reference"),
        ReferentId: new("entity-w")
    );

    public static readonly RefersTo ThisYearReference = new(
        AnaphorPhraseId: new("phrase-this-year-reference"),
        ReferentId: new("entity-this-year")
    );

    public static readonly RequestsValue NextYearRequest = new(
        RequestedByPhraseId: new("phrase-target"),
        RequestedEntityId: new("entity-next-year")
    );

    public static readonly SemanticModel Semantics = new(
        Entities:
        [
            W,
            ThisYear,
            NextYear
        ],
        Edges:
        [
            ThisYearDerivation,
            NextYearDerivation,
            LastYearReference,
            ThisYearReference,
            NextYearRequest
        ],
        LatentFacts:
        [
            ThisYearScaleFactor,
            ThisYearIncrement,
            NextYearScaleFactor
        ]
    );

    public static readonly PracticeItemId Id = new("practice-item-sample-2");

    public static readonly PracticeItem Item = new(
        Id: Id,
        Text: Text,
        Semantics: Semantics,
        Answers: Answers,
        CorrectAnswerId: new("answer-d")
    );
}
