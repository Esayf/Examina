import { Field, ZkProgram, SelfProof, Provable, UInt64, Bool } from 'o1js';

export const CalculateScore = ZkProgram({
    name: "calculate-score",
    publicInput: Field,
    publicOutput: Field,

    methods: {
        baseCase: {
            privateInputs: [],

            method(x: Field) {
                x.assertEquals(Field(1));

                return Field(1)
            },
        },

        step: {
            privateInputs: [SelfProof, Field, Field, Field],

            method(x: Field, earlierProof: SelfProof<Field, Field>, user_answers: Field, answers: Field, score: Field) {
                earlierProof.verify();
                earlierProof.publicInput.mul(10).assertEquals(x);
                earlierProof.publicOutput.assertEquals(score)

                const ua = UInt64.from(user_answers).mod(UInt64.from(x)).div(UInt64.from(x).div(10)).toFields()[0]
                const a = UInt64.from(answers).mod(UInt64.from(x)).div(UInt64.from(x).div(10)).toFields()[0]
                
                const equation = new Bool(UInt64.from(a).equals(UInt64.from(ua)))

                return score.add(Provable.if(equation, Field(1), Field(0)))
            },
        },
    },
});