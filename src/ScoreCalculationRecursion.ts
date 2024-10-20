import { Field, Struct, Poseidon, ZkProgram, DynamicProof, FeatureFlags, Gadgets, UInt64 } from 'o1js';
import {Provable} from 'o1js/dist/node/index'
import { PublicAnswerProofOutputs, AnswersProver } from './AnswerProver';
import { UInt256 } from './UInt256';
const 
    INITIAL_CORRECTS = 0,
    INITIAL_INCORRECTS = 0,
    BLANK_VALUE = 0,
    INCREMENT = 1,
    ANSWER_SEPERATOR = UInt256.from(7),
    SEPERATOR_SHIFT_PER_ANSWER = 3;
    
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
                return x;
            }
        }
    }
})