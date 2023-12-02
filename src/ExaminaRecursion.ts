import { Field, ZkProgram, SelfProof, Provable, UInt64, Bool, Struct, PrivateKey, Poseidon } from 'o1js';
import { MerkleWitnessClass } from './Examina.js'

export class PublicInputs extends Struct({
    userAnswers: Field,
    answers: Field,
    index: Field,
}) {
    updateIndex() {
        return new PublicInputs({
            userAnswers: this.userAnswers,
            answers: this.answers,
            index: this.index.add(3),
        })
    }
}

export const CalculateScore = ZkProgram({
    name: "calculate-score",
    publicInput: PublicInputs,
    publicOutput: Field,

    methods: {
        baseCase: {
            privateInputs: [],

            method(x: PublicInputs) {
                x.index.assertEquals(Field(-3))

                return Field(0)
            },
        },

        step: {
            privateInputs: [SelfProof, Field],

            method(x: PublicInputs, earlierProof: SelfProof<PublicInputs, Field>, score: Field) {
                earlierProof.verify();
                
                earlierProof.publicInput.index.add(3).assertEquals(x.index)
                earlierProof.publicOutput.assertEquals(score)
                earlierProof.publicInput.answers.assertEquals(x.answers)
                earlierProof.publicInput.userAnswers.assertEquals(x.userAnswers)

                const answers = x.answers.toBits(15) // 21835
                const userAnswers = x.userAnswers.toBits(15) // 13643

                const s1 = (answers[2].or(userAnswers[2])).and(answers[2].not().or(userAnswers[2].not()))
                
                const equation = s1.equals(false)

                return score.add(Provable.if(equation, Field(1), Field(0)))
            },
        },
    },
});