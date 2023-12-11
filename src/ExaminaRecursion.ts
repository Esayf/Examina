import { Field, ZkProgram, SelfProof, Provable, Struct, Bool, Poseidon, UInt64 } from 'o1js';

export class PublicOutputs extends Struct({
    score: Field,
    wrongAnswerCount: Field
}) {
    constructor(score: Field, wrongAnswerCount: Field) {
        super({
            score,
            wrongAnswerCount
        })

        this.score = score
        this.wrongAnswerCount = wrongAnswerCount
    }
    
    correct() {
        return new PublicOutputs(this.score.add(Field(1)), this.wrongAnswerCount)
    }

    incorrect(incorrectToCorrectRatio: Field) {
        const newWrongAnswerCount = this.wrongAnswerCount.add(Field(1))

        const remainder = UInt64.from(newWrongAnswerCount).mod(UInt64.from(incorrectToCorrectRatio))
        const equation = remainder.equals(UInt64.from(0))

        const score = Provable.if(equation, this.score.sub(Field(1)), this.score)

        return new PublicOutputs(score, newWrongAnswerCount)
    }
}

export const CalculateScore = ZkProgram({
    name: "calculate-score",
    publicInput: Field,
    publicOutput: PublicOutputs,

    methods: {
        baseCase: {
            privateInputs: [Field, Field, Field, Field],

            method(secureHash: Field, answers: Field, userAnswers: Field, index: Field, incorrectToCorrectRatio: Field) {
                index.assertEquals(-3)
                secureHash.assertEquals(Poseidon.hash([answers, userAnswers, index, incorrectToCorrectRatio]))

                return new PublicOutputs(Field(0), Field(0))
            },
        },

        step: {
            privateInputs: [SelfProof, Field, Field, Field, Field, Field, Field],

            method (
                secureHash: Field,
                earlierProof: SelfProof<Field, PublicOutputs>,
                answers: Field,
                userAnswers: Field,
                index: Field,
                answer: Field,
                userAnswer: Field,
                incorrectToCorrectRatio: Field
            ) {
                earlierProof.verify();
                
                earlierProof.publicInput.assertEquals(Poseidon.hash([answers, userAnswers, index.sub(3), incorrectToCorrectRatio]))
                secureHash.assertEquals(Poseidon.hash([answers, userAnswers, index, incorrectToCorrectRatio]))

                const publicOutputs = earlierProof.publicOutput

                const bitsOfAnswers = answers.toBits()
                const bitsOfUserAnswers = userAnswers.toBits()

                const equation = (userAnswer.equals(answer).and(answer.equals(0).not())).toField()

                const confirm = Provable.witness(
                    Field,
                    () => {
                        const i = Number(index)
                        
                        const a = Field.fromBits(bitsOfAnswers.slice(i, i + 3))
                        const ua = Field.fromBits(bitsOfUserAnswers.slice(i, i + 3))

                        return ua.equals(a).and(a.equals(0).not()).toField()
                    }
                )

                equation.assertEquals(confirm)

                const { score, wrongAnswerCount } = Provable.if (
                    Bool.fromFields(equation.toFields()),
                    PublicOutputs,
                    publicOutputs.correct(),
                    publicOutputs.incorrect(incorrectToCorrectRatio)
                )

                return new PublicOutputs(score, wrongAnswerCount)
            },
        },
    },
});