import { Field, Struct, Poseidon, ZkProgram, DynamicProof, FeatureFlags, Gadgets, UInt64, UInt8, MerkleWitness } from 'o1js';
import { Provable } from 'o1js/dist/node/index'
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

/* class AnswerProof extends DynamicProof<Field, UserAnswerWitness> {
    static publicInputType = Field;
    static publicOutputType = UserAnswerWitness;
    static maxProofsVerified = 0 as const;
    
    // we use the feature flags that we computed from the `answerProof` ZkProgram
    static featureFlags = featureFlags;
} */

export class UserAnswers extends Struct({
    answers: Provable.Array(Field, 80),
}) {
    constructor(answers: Field[]) {
        super({
            answers
        })
        this.answers = answers;
    }
}



export class CorrectAnswers extends Struct({
    answers: Provable.Array(Field, 80),
}) {
    constructor(answers: Field[]) {
        super({
            answers
        })
        this.answers = answers;
    }
}

export class ScoreOutputs extends Struct({
    lastQuestionIndex: Field,
    corrects: UInt8,
}) {
    constructor(lastQuestionIndex: Field, corrects: UInt8) {
        super({
            lastQuestionIndex,
            corrects
        })
        this.lastQuestionIndex = lastQuestionIndex;
        this.corrects = corrects;
    }
}

export const ScoreCalculationLoop = ZkProgram({
    name: "score-calculation-loop",
    publicOutput: Field,
    methods: {
        calculateScore: {
            privateInputs: [UserAnswers, CorrectAnswers],
            async method(answers: UserAnswers, correctAnswers: CorrectAnswers) {
                let corrects = new Field("0");
                for (let i = 0; i < 80; i+=1) {
                    const isCorrect = answers.answers[i].equals(correctAnswers.answers[i]);
                    corrects = Provable.if(isCorrect, corrects.add(Field.from("1")), corrects);
                }

                return { publicOutput: corrects };
            }
        }
    }
})
