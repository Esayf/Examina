import {
    Field,
    Poseidon,
    SmartContract,
    State,
    method,
    state,
    PrivateKey,
    Reducer,
    Struct,
    PublicKey,
    MerkleWitness,
    ZkProgram,
    Gadgets
} from 'o1js';
import { UInt240 } from "./int.js"
import {
    CalculateScore
} from './ExaminaRecursion.js'

export class MerkleWitnessClass extends MerkleWitness(20) {}

await CalculateScore.compile()

class CalculateProof extends ZkProgram.Proof(CalculateScore) {}

export class UserAnswers extends Struct({
    publicKey: PublicKey,
    answers: Field,
    witness: MerkleWitnessClass
}) {
    constructor (publicKey: PublicKey, answers: Field, witness: MerkleWitnessClass) {
        super({publicKey, answers, witness});
        this.publicKey = publicKey;
        this.answers = answers;
        this.witness = witness;
    }

    hash() {
        return Poseidon.hash(this.publicKey.toFields().concat(this.answers));
    }
}

export class Controller extends Struct({
    secureHash: Field,
    answers: Field,
    userAnswers: Field,
    index: Field,
    incorrectToCorrectRatio: Field
}) {
    constructor (secureHash: Field, answers: Field, userAnswers: Field, index: Field, incorrectToCorrectRatio: Field) {
        super({secureHash, answers, userAnswers, index, incorrectToCorrectRatio});
        this.secureHash = secureHash;
        this.answers = answers;
        this.userAnswers = userAnswers;
        this.index = index;
        this.incorrectToCorrectRatio = incorrectToCorrectRatio;
    }

    hash() {
        return Poseidon.hash([this.answers, this.userAnswers, this.index, this.incorrectToCorrectRatio]);
    }
}

const SHIFT_ISOVER = 0
const SHIFT_RATIO = 1
const MASK_ISOVER = Field(1)
const MASK_RATIO = Field(7)
const FINISH = Field(1)
const CONTINUES = Field(0)

export class Examina extends SmartContract {
    reducer = Reducer({ actionType: UserAnswers });

    @state(Field) answers = State<Field>();
    @state(Field) hashedQuestions = State<Field>();
    @state(Field) usersRoot = State<Field>();
    @state(Field) actionState = State<Field>();
    @state(Field) examSecretKey = State<Field>();
    @state(Field) informations = State<Field>();

    init() {
        super.init();
        this.actionState.set(Reducer.initialActionState);
        this.informations.set(CONTINUES);

        this.requireSignature();
    }

    @method initState(
        answers: Field,
        secretKey: Field,
        hashed_questions: Field,
        usersInitialRoot: Field,
        incorrectToCorrectRatio: Field
    ) {
        this.answers.set(Poseidon.hash([answers, secretKey]));
        this.hashedQuestions.set(hashed_questions);
        this.usersRoot.set(usersInitialRoot);
        this.examSecretKey.set(Poseidon.hash(secretKey.toFields()));

        const informations = this.informations.getAndAssertEquals();
        const shifted = Gadgets.leftShift(incorrectToCorrectRatio, SHIFT_RATIO);

        const not_ratio = Gadgets.not(shifted, 128);
        const not_informations = Gadgets.not(informations, 128);
        const set = Gadgets.and(not_informations, not_ratio, 128);

        this.informations.set(Gadgets.not(set, 128));
    }

    @method checkIsOver(check: Field) {
        const informations = this.informations.getAndAssertEquals();

        const shifted = Gadgets.rightShift(informations, SHIFT_ISOVER);
        const isOver = Gadgets.and(shifted, MASK_ISOVER, 1);

        isOver.assertEquals(check);
    }

    @method setIsOver(value: Field) {
        const informations = this.informations.getAndAssertEquals();

        const not_informations = Gadgets.not(informations, 128);
        const not_value = Gadgets.not(value, 128);

        const process = Gadgets.and(not_informations, not_value, 128);

        this.informations.set(Gadgets.not(process, 128));
    }

    @method getRatio(): Field {
        const informations = this.informations.getAndAssertEquals();

        const shifted = Gadgets.rightShift(informations, SHIFT_RATIO);
        const ratio = Gadgets.and(shifted, MASK_RATIO, 3);

        return ratio;
    }

    @method submitAnswers(privateKey: PrivateKey, answers: Field, witness: MerkleWitnessClass) {
        this.checkIsOver(CONTINUES);

        const user = new UserAnswers(privateKey.toPublicKey(), answers, witness);

        this.reducer.dispatch(user);
    }

    @method publishAnswers(answers: Field, secretKey: Field) {
        this.checkIsOver(CONTINUES);

        const initalAnswers = this.answers.getAndAssertEquals();

        const hashedAnswers = Poseidon.hash([answers, secretKey]);
        initalAnswers.assertEquals(hashedAnswers);

        const usersRoot = this.usersRoot.getAndAssertEquals();
        const actionState = this.actionState.getAndAssertEquals();

        this.setIsOver(Field(1));

        let pendingActions = this.reducer.getActions({
            fromActionState: actionState,
        })

        let { state: newRoot, actionState: newActionState } =
        this.reducer.reduce(
            pendingActions,
            Field,
            (_state: Field, action: UserAnswers) => {
                const hash = action.hash();

                return action.witness.calculateRoot(hash);
            },
            { state: usersRoot, actionState }
        )

        this.usersRoot.set(newRoot);
        this.actionState.set(newActionState);

        this.answers.set(answers);
        this.examSecretKey.set(secretKey);
    }

    @method verifyQuestions(hashedExam: Field) {
        const hash = this.hashedQuestions.getAndAssertEquals();
        
        return hash.equals(hashedExam);
    }

    @method checkScore(proof: CalculateProof, witness: MerkleWitnessClass, privateKey: PrivateKey, controller: Controller) {
        this.checkIsOver(FINISH);
        
        proof.verify();

        const usersRoot = this.usersRoot.getAndAssertEquals();
        const answers = this.answers.getAndAssertEquals();
        const incorrectToCorrectRatio = this.getRatio();

        const secureHash = controller.secureHash;
        proof.publicInput.assertEquals(secureHash);

        secureHash.assertEquals(controller.hash());

        answers.assertEquals(controller.answers);
        incorrectToCorrectRatio.assertEquals(controller.incorrectToCorrectRatio);
        
        const witnessRoot = witness.calculateRoot(Poseidon.hash(privateKey.toPublicKey().toFields().concat(controller.userAnswers)));
        usersRoot.assertEquals(witnessRoot);

        const incorrects = proof.publicOutput.incorrects;
        const corrects = proof.publicOutput.corrects;
;
        const quotient = incorrects.div(UInt240.from(incorrectToCorrectRatio));

        const score = corrects.sub(quotient);

        return score;
    }
}