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
    Gadgets,
    UInt64,
    Provable,
} from 'o1js';
import { UInt240 } from "./int.js";
import {
    CalculateScore
} from './ExaminaRecursion.js';

export class MerkleWitnessClass extends MerkleWitness(20) {}

await CalculateScore.compile();

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
}) {
    constructor (secureHash: Field, answers: Field, userAnswers: Field, index: Field) {
        super({secureHash, answers, userAnswers, index});
        this.secureHash = secureHash;
        this.answers = answers;
        this.userAnswers = userAnswers;
        this.index = index;
    }

    hash() {
        return Poseidon.hash([this.answers, this.userAnswers, this.index]);
    }

    userAnswersHash(publicKey: PublicKey) {
        return Poseidon.hash(publicKey.toFields().concat(this.userAnswers));
    }
}

export class Examina extends SmartContract {
    reducer = Reducer({ actionType: UserAnswers });

    @state(Field) answers = State<Field>();
    @state(Field) hashedQuestions = State<Field>();
    @state(Field) usersRoot = State<Field>();
    @state(Field) actionState = State<Field>();
    @state(Field) examSecretKey = State<Field>();
    @state(Field) ratio = State<Field>();
    @state(Field) durations = State<Field>();
    @state(Field) startDate = State<Field>();

    init() {
        super.init();
        this.actionState.set(Reducer.initialActionState);

        this.requireSignature();
    }

    @method initState(
        answers: Field,
        secretKey: Field,
        hashed_questions: Field,
        usersInitialRoot: Field,
        ratio: Field,
        durations: Field,
        startDate: Field
    ) {
        this.answers.set(Poseidon.hash([answers, secretKey]));
        this.hashedQuestions.set(hashed_questions);
        this.usersRoot.set(usersInitialRoot);
        this.examSecretKey.set(Poseidon.hash(secretKey.toFields()));
        this.ratio.set(ratio);
        this.durations.set(durations);
        this.startDate.set(startDate);
        //this.informations.set(informations); // 4 bit => ratio, 25 bit => durations, 64 bit => startDate
    }

    @method checkIsOver() {
        const durations = UInt64.from(this.durations.getAndRequireEquals())
        const startDate = UInt64.from(this.startDate.getAndRequireEquals())
        const endDate = startDate.add(durations)

        const timestamps = this.network.timestamp.getAndRequireEquals()

        timestamps.assertGreaterThanOrEqual(endDate)
    }

    @method checkIsContinue() {
        const durations = UInt64.from(this.durations.getAndRequireEquals())
        const startDate = UInt64.from(this.startDate.getAndRequireEquals())
        const endDate = startDate.add(durations)

        this.network.timestamp.requireBetween(startDate, endDate)
    }

    @method submitAnswers(privateKey: PrivateKey, answers: Field, witness: MerkleWitnessClass) {
        //this.checkIsContinue()

        const user = new UserAnswers(privateKey.toPublicKey(), answers, witness);

        this.reducer.dispatch(user);
    }

    @method publishAnswers(answers: Field, secretKey: Field) {
        //this.checkIsOver();

        const initalAnswers = this.answers.getAndRequireEquals();

        const hashedAnswers = Poseidon.hash([answers, secretKey]);
        initalAnswers.assertEquals(hashedAnswers);

        this.answers.set(answers);
        this.examSecretKey.set(secretKey);
    }

    @method verifyQuestions(hashedExam: Field) {
        const hash = this.hashedQuestions.getAndRequireEquals();
        
        return hash.equals(hashedExam);
    }

    @method validateUserAnswers(controller: Controller, publicKey: PublicKey) {
        const userAnswersHash = controller.userAnswersHash(publicKey);
        let pendingActions = this.reducer.getActions({
            fromActionState: Reducer.initialActionState,
        })
        let initial = {
            state: Field(0),
            actionState: Reducer.initialActionState,
        }; 

        let { state: answerCounter, actionState: newActionState } =
        this.reducer.reduce(
            pendingActions,
            Field,
            (state: Field, action: UserAnswers) => {
                return Provable.if(action.publicKey.equals(publicKey),
                Provable.if(action.hash().equals(userAnswersHash), state.add(1), state), state);  
            },
            initial
        )
        return answerCounter.assertEquals(1)
    }

    @method checkScore(proof: CalculateProof, privateKey: PrivateKey, controller: Controller) {
        //this.checkIsOver();
        this.validateUserAnswers(controller, privateKey.toPublicKey());
        proof.verify();

        const answers = this.answers.getAndRequireEquals();
        const incorrectToCorrectRatio = this.ratio.getAndRequireEquals();

        const secureHash = controller.secureHash;
        proof.publicInput.assertEquals(secureHash);

        secureHash.assertEquals(controller.hash());

        answers.assertEquals(controller.answers);
        

        const incorrects = proof.publicOutput.incorrects;
        const corrects = proof.publicOutput.corrects;
        const quotient = incorrects.div(UInt240.from(incorrectToCorrectRatio));

        const score = corrects.sub(quotient);

        return score;
    }
}