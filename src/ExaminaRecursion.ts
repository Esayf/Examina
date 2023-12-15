import { Field, ZkProgram, SelfProof, Provable, Struct, Poseidon, Int64 } from 'o1js';
import { UInt240 } from "./int.js"

export class PublicOutputs extends Struct({
    corrects: UInt240,
    incorrects: UInt240
}) {
    constructor(corrects: UInt240, incorrects: UInt240) {
        super({
            corrects,
            incorrects
        })

        this.corrects = corrects
        this.incorrects = incorrects
    }
    
    correct() {
        return new PublicOutputs(this.corrects.add(1), this.incorrects)
    }

    incorrect() {
        return new PublicOutputs(this.corrects, this.incorrects.add(1))
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
                index.mul(10).assertEquals(1)
                secureHash.assertEquals(Poseidon.hash([answers, userAnswers, index, incorrectToCorrectRatio]))

                return new PublicOutputs(UInt240.from(0), UInt240.from(0))
            },
        },

        calculate: {
            privateInputs: [SelfProof, Field, Field, Field, Field],

            method (
                secureHash: Field,
                earlierProof: SelfProof<Field, PublicOutputs>,
                answers: Field,
                userAnswers: Field,
                index: Field,
                incorrectToCorrectRatio: Field
            ) { 
                earlierProof.verify();
                
                earlierProof.publicInput.assertEquals(Poseidon.hash([answers, userAnswers, index.div(10), incorrectToCorrectRatio]))
                secureHash.assertEquals(Poseidon.hash([answers, userAnswers, index, incorrectToCorrectRatio]))

                const publicOutputs = earlierProof.publicOutput

                const i = UInt240.from(index)

                const a = UInt240.from(answers)
                const ua = UInt240.from(userAnswers)

                const remainderOfAnswers = a.div(i).mod(10).toField()
                const remainderOfUserAnswers = ua.div(i).mod(10).toField()

                const equation = remainderOfAnswers.equals(0).not().and(remainderOfAnswers.equals(remainderOfUserAnswers))

                const { corrects, incorrects } = Provable.if (
                    equation,
                    PublicOutputs,
                    publicOutputs.correct(),
                    publicOutputs.incorrect()
                )

                return new PublicOutputs(corrects, incorrects)
            },
        },
    },
});