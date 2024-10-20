import { Field, Struct, Poseidon, ZkProgram, DynamicProof, FeatureFlags, Gadgets, UInt64 } from 'o1js';
import { PublicAnswerProofOutputs, AnswersProver } from './AnswerProver';
import { UInt256 } from './UInt256';
const 
    INITIAL_CORRECTS = 0,
    INITIAL_INCORRECTS = 0,
    BLANK_VALUE = 0,
    INCREMENT = 1,
    ANSWER_SEPERATOR = UInt256.from(7),
    SEPERATOR_SHIFT_PER_ANSWER = 3;

function countSetBitsBigInt(v: Field) {
    const fieldV = v;
    const v1 = v.sub(Gadgets.and(Gadgets.rightShift64(fieldV, 1), Field(0x5555555555555555n), 64));
    const v2 = Gadgets.and(v1, Field(0x3333333333333333n), 64).add(Gadgets.and(Gadgets.rightShift64(v1, 2), Field(0x3333333333333333n), 64));
    const v3 = Gadgets.and(v2.add(Gadgets.rightShift64(v2, 4)), Field(0x0F0F0F0F0F0F0F0Fn), 64);
    const v5 = v3.add(Gadgets.rightShift64(v3, 8));
    const v6 = v5.add(Gadgets.rightShift64(v5, 16));
    const v7 = v6.add(Gadgets.rightShift64(v6, 32));
    return Gadgets.and(v7, Field(0x7Fn), 64);
}
    
const featureFlags = await FeatureFlags.fromZkProgram(AnswersProver);

class AnswerProof extends DynamicProof<Field, Field> {
    static publicInputType = Field;
    static publicOutputType = Field;
    static maxProofsVerified = 0 as const;
    
    // we use the feature flags that we computed from the `answerProof` ZkProgram
    static featureFlags = featureFlags;
    }
export class ScoreOutputs extends Struct({
    corrects: UInt256,
    incorrects: UInt256
}) {
    constructor(corrects: UInt256, incorrects: UInt256) {
        super({
            corrects,
            incorrects
        })
        this.corrects = corrects;
        this.incorrects = incorrects;
    }
}

export const ScoreCalculator = ZkProgram({
    name: "score-calculator",
    publicInput: Field,
    publicOutput: Field,
    methods: {
        calculateScore: {
            privateInputs: [],
            async method(x :Field) {
                return countSetBitsBigInt(Field.from(0b01101101));
            }
        }
    }
})