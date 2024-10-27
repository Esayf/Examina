import { Field, ZkProgram, Gadgets } from 'o1js';


function countSetBitsBigInt(v: Field): Field {
    const fieldV = v;
    const v1 = v.sub(Gadgets.and(Gadgets.rightShift64(fieldV, 1), Field(0x5555555555555555n), 64));
    const v2 = Gadgets.and(v1, Field(0x3333333333333333n), 64).add(Gadgets.and(Gadgets.rightShift64(v1, 2), Field(0x3333333333333333n), 64));
    const v3 = Gadgets.and(v2.add(Gadgets.rightShift64(v2, 4)), Field(0x0F0F0F0F0F0F0F0Fn), 64);
    const v5 = v3.add(Gadgets.rightShift64(v3, 8));
    const v6 = v5.add(Gadgets.rightShift64(v5, 16));
    const v7 = v6.add(Gadgets.rightShift64(v6, 32));
    return Gadgets.and(v7, Field(0x7Fn), 64);
}

export const ScoreCalculator = ZkProgram({
    name: "score-calculator",
    publicOutput: Field,
    methods: {
        calculateScore: {
            privateInputs: [Field, Field],
            async method(userAnswers: Field, correctAnswers: Field) {
                const incorrectsNotCut = Gadgets.xor(userAnswers, correctAnswers, 64);
                const score = countSetBitsBigInt(incorrectsNotCut);
                return { publicOutput: score };
            }
        }
    }
})
