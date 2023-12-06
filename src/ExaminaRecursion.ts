import { Field, ZkProgram, SelfProof, Provable, Struct, Bool, Poseidon } from 'o1js';

export const CalculateScore = ZkProgram({
    name: "calculate-score",
    publicInput: Field,
    publicOutput: Field,

    methods: {
        baseCase: {
            privateInputs: [Field, Field, Field],

            method(secureHash: Field, answers: Field, userAnswers: Field, index: Field) {
                index.assertEquals(-3)
                secureHash.assertEquals(Poseidon.hash([answers, userAnswers, index]))

                return Field(0)
            },
        },

        step: {
            privateInputs: [SelfProof, Field, Field, Field, Field, Field, Field],

            method(secureHash: Field, earlierProof: SelfProof<Field, Field>, answers: Field, userAnswers: Field, index: Field, answer: Field,  userAnswer: Field, score: Field) {
                earlierProof.verify();
                
                earlierProof.publicInput.assertEquals(Poseidon.hash([answers, userAnswers, index.sub(3)]))
                secureHash.assertEquals(Poseidon.hash([answers, userAnswers, index]))

                earlierProof.publicOutput.assertEquals(score)

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

                return Provable.if(Bool.fromFields(equation.toFields()), score.add(1), score)
            },
        },
    },
});